

import axios from "axios";
import {get_transaction_by_state, updateTransactionState, createOpenOrder, get_transaction_by_date_and_state, getBuyTrackerRecordsByAddress, getAllOpenOrders, deleteOpenOrder, getBuyTrackerRecordByAddress, updateOpenOrderProfitAndLoss, insertSellTrackerDocument, getOpenOrderRecordByAddress} from "./mongoDB_connection"
import { getAllBalances, getTokenBalance } from './my_wallet';
export {processPendingTransactions, processCompleteTransactions, process_sell, manageOpenOrders};
import {pre_and_post_sell_operations, pre_and_post_buy_operations_v2, pre_and_post_sell_operations_v2} from './jupiter_swap_STABLE_VERSION'
import {send_message, send_message_to_private_group} from './telegram_bot';


function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

interface TokenTransfer {
    fromTokenAccount: string;
    toTokenAccount: string;
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
    tokenStandard: string;
}

interface UpdateFields {
  price_change_percent: string;
  profit_and_loss: string;
  stop_loss?: number | null;
  TP_1?: number | null; // Optional number or null
  TP_2?: number | null; // Optional number or null
}

interface OpenOrder {
    tx_date: string;
    address: String;
    symbol: String;
    usd_spent: number;
    entry_price: number;
    token_amount_received: number;
    stop_loss: number;
    TP_1: number;
    TP_2: number;
    price_change_percent?: string;
    profit_and_loss?: string;
  }

  interface SellData {
    buy_date: string;
    sell_date: string;
    address: string;
    symbol: String;
    usdc_spent: number;
    entry_price: number;
    message: string;
    token_amount_sold: number;
    usdc_received: number;
    profit_and_loss: number;
  }

  interface TokenToSellMongo {
    address: String;
    token_amount_sold: number;
    profit_in_usd: number;
    message: String;
}

  async function process_sell(data: TokenToSellMongo): Promise<void> {

    console.log("inside process_sell()")
    try {
      // Get buy tracker record
      //const buyRecord = await getBuyTrackerRecordByAddress(data.address.toString());
  
      // Get open order record
      const openOrderRecord = await getOpenOrderRecordByAddress(data.address.toString());
  
      if (!openOrderRecord) {
        console.error(`Could not find records for address ${data.address.toString()}`);
        return;
      }
  
      const currentDate = new Date();
      const sell_date = currentDate.toISOString().slice(0, 19).replace('T', ' ');
  
      const profit_and_loss = data.message.includes("% SL reached")
        ? data.profit_in_usd - openOrderRecord.usd_spent
        : data.profit_in_usd - ((data.token_amount_sold * openOrderRecord.usd_spent) / openOrderRecord.token_amount_received);
  
      const sellData: SellData = {
        buy_date: openOrderRecord.tx_date,
        sell_date: sell_date,
        address: (data.address).toString(),
        symbol: openOrderRecord.symbol,
        usdc_spent: openOrderRecord.usd_spent,
        entry_price: openOrderRecord.entry_price,
        message: (data.message).toString(),
        token_amount_sold: data.token_amount_sold,
        usdc_received: data.profit_in_usd,
        profit_and_loss: profit_and_loss
      };
  
      send_message(`🟢‼️✅ NEW SELL 🚨🟢🔥\n\n${data.message}\n\nSold:   ${data.token_amount_sold} ${openOrderRecord.symbol}\nUSDC received:   $${(profit_and_loss).toFixed(2)} USDC\n\nToken address:\n${data.address}\n\nDexTools link:\nhttps://www.dextools.io/app/pt/solana/pair-explorer/${data.address}?t=1713211991329\n\nSell link:\nhttps://jup.ag/swap/${data.address}-USDC\n\n@Furymuse`);

      await insertSellTrackerDocument(sellData);
      console.log(`Sell data for address ${data.address} inserted into sell_tracker collection.`);
    } catch (error) {
      console.error('Error processing sell:', error);
    }
  }


  async function manageOpenOrders() {
    // Process all completed transactions first

    // Fetch all open orders
    const openOrders = await getAllOpenOrders();

    // Get addresses from open orders
    const addresses = openOrders.map(order => order.address.toString());

    // Fetch token prices and balances
    const pricesMap = await get_token_prices(addresses);
    const balancesMap = await getAllBalances();

    for (const order of openOrders) {
        const currentPrice = pricesMap.get(order.address.toString());
        const currentBalance = balancesMap[order.address.toString()] || 0;

        // Remove order if balance is less than 1
        if (currentBalance < 1) {
            await deleteOpenOrder(order.address.toString());
            continue;
        }

        if (typeof currentPrice === 'undefined') {
          console.log(`Current price for address ${order.address} is undefined.`);
          continue; // Skip processing this order
        }

        // Calculate price change percent and profit and loss
        let priceChangePercent = ((currentPrice - order.entry_price) / order.entry_price) * 100;
        let profitAndLoss = (currentBalance * currentPrice * priceChangePercent) / 100;

        // Update order details
        const updateFields: UpdateFields = {
          price_change_percent: priceChangePercent.toFixed(2),
          profit_and_loss: profitAndLoss.toFixed(2)
      };

        if (!order.TP_1) {
            updateFields.stop_loss = order.entry_price * 1.35;
        }
        // Handle stop loss and take profit scenarios
        let message = "";
        if (currentPrice <= order.stop_loss) {

            
            console.log("Stop loss hit!!");
            console.log(`\NCURRENT PRICE: ${currentPrice}\nSTOP LOSS PRICE: ${order.stop_loss}`);
            send_message(`Stop Loss, about to sell ${order.address}\n\n@Furymuse`)
            if (currentPrice < order.entry_price) {
              message = `-25% SL reached!!`;
            } else{
              message = `Breakeaven SL reached!!`;
            }
            await pre_and_post_sell_operations_v2(currentBalance, order.address, order.symbol, message);
           

      } else {
          if (order.TP_1 && currentPrice >= order.TP_1) {
              
              console.log("TP 1 hit!!!");
              send_message(`TP 1 hit, about to sell ${order.address}\n\n@Furymuse`)
              const result = await pre_and_post_sell_operations_v2((currentBalance * 0.7), order.address, order.symbol, "TP 1 reached!!");
              if (result) {
                updateFields.TP_1 = null;  // Clear TP_1
                updateFields.stop_loss = order.entry_price * 1.30
              }


          }
          if (!order.TP_1 && order.TP_2 && currentPrice >= order.TP_2) {
             
              console.log("TP 2 hit!!!");
              send_message(`TP 2 hit, about to sell ${order.address}\n\n@Furymuse`)
              const result = await pre_and_post_sell_operations_v2((currentBalance * 0.7), order.address, order.symbol, "TP 2 reached!!");
              if (result) {
                updateFields.TP_2 = null;  // Clear TP_2
                updateFields.stop_loss = order.entry_price * 1.95
              }

          }
      }

        // Update the order in the database
        await updateOpenOrderProfitAndLoss(order.address.toString(), updateFields);
    }
}


  async function get_token_prices(tokenAddresses: string[]): Promise<Map<string, number>> {
    const MAX_ADDRESSES_PER_CALL = 30;
    const priceMap = new Map<string, number>();

    for (let i = 0; i < tokenAddresses.length; i += MAX_ADDRESSES_PER_CALL) {
        const chunk = tokenAddresses.slice(i, i + MAX_ADDRESSES_PER_CALL);
        const joinedAddresses = chunk.join('%2C');
        const url = `https://public-api.birdeye.so/defi/multi_price?list_address=${joinedAddresses}`;
        const headers = { "X-API-KEY": "1368ab5cd35549da9d2111afa32c829f" };

        try {
            await delay(2000);
            const response = await axios.get(url, { headers });
            const prices = response.data.data;

            console.log("Fetched new prices from API for chunk");
            

            for (const address of chunk) {
                const price = prices[address]?.value;
                if (price !== undefined) {
                    priceMap.set(address, price);
                }
            }
        } catch (error) {
            console.error("Error fetching token prices for chunk", error);
            // Optionally throw the error or handle it as needed
        }
    }

    return priceMap;
}

async function waitForTransactionConfirmation(signature: string, tokenAddress: string, usdcMintAddress: string): Promise<{ tokenAmountReceived: number, usdcAmountSpent: number, error: any }> {
  console.log(`Waiting for transaction confirmation for signature: ${signature}`);
  let tokenAmountReceived: number = 0;
  let usdcAmountSpent: number = 0;
  let error: any = null;
  let delayTime = 13000; // Starting delay of 11 seconds
  const maxAttempts = 6; // Maximum attempts
  let attempts = 0;

  const apiKey = '718ea21d-2d9d-49e2-b3f2-46888e0fcb25'; // Helius API key
  const url = `https://api.helius.xyz/v0/transactions/?api-key=${apiKey}`;

  while (attempts < maxAttempts) {
    try {
      console.log("ABOUT TO REQUEST FROM HELIUS");
      await delay(delayTime);
      const response = await axios.post(url, { transactions: [signature] }, { headers: { 'Content-Type': 'application/json' } });
      const transactions = response.data;
      
      if (transactions.length > 0) {
        const transaction = transactions[0];

        console.log("DEBUG: Transaction details received:", transaction);

        const tokenTransfers: TokenTransfer[] = transaction.tokenTransfers;
        const tokenTransfer = tokenTransfers.find(t => t.mint === tokenAddress);
        const usdcTransfer = tokenTransfers.find(t => t.mint === usdcMintAddress);

        if (tokenTransfer) {
          tokenAmountReceived = tokenTransfer.tokenAmount;
          console.log(`Token amount received: ${tokenAmountReceived}`);
        }

        if (usdcTransfer) {
          usdcAmountSpent = usdcTransfer.tokenAmount;
          console.log(`USDC amount spent: ${usdcAmountSpent}`);
        }

        if (transaction.error) {
          error = transaction.error;
        }

        if (tokenAmountReceived > 0 || usdcAmountSpent > 0 || error) {
          break; // Exit loop if either token amount, USDC amount, or error is recorded
        }
      } else {
        console.log(`Transaction ${signature} not yet confirmed, checking again in ${delayTime / 1000} seconds...`);
      }

      attempts++;
    } catch (error) {
      console.error("Error fetching transaction details:", error);
      return { tokenAmountReceived, usdcAmountSpent, error };
    }
  }

  return { tokenAmountReceived, usdcAmountSpent, error };
}


async function processPendingTransactions() {

  let new_buy = false;
  try {
    const pendingTransactions = await get_transaction_by_state("pending");
    for (const transaction of pendingTransactions) {
        const { tokenAmountReceived, usdcAmountSpent, error } = await waitForTransactionConfirmation(transaction.signature, transaction.address.toString(), "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

        let newState = "failed"; // Default state is "failed"
        if (tokenAmountReceived > 0 && usdcAmountSpent > 0 && (!error || error === null || error === undefined || error === "")) {
            newState = "completed";
            new_buy = true;
            await send_message_to_private_group(`🟢‼️✅ NEW TOKEN ALERT 🚨🟢🔥\n\nToken Symbol: ${transaction.symbol}\n\nToken address:\n\n${transaction.address}\n\nDexTools link:\nhttps://www.dextools.io/app/pt/solana/pair-explorer/${transaction.address}?t=1713211991329\n\nJupiter link:\nhttps://jup.ag/swap/USDC-${transaction.address}`);
            await send_message(`🟢‼️✅ NEW BUY 🚨🟢🔥\n\nSpent: $${usdcAmountSpent.toFixed(2)} USDC\nGot: ${tokenAmountReceived.toFixed(2)} ${transaction.symbol}\n\nToken address\n\n${transaction.address}\n\nDexTools link:\nhttps://www.dextools.io/app/pt/solana/pair-explorer/${transaction.address}?t=1713211991329\n\nBuy link:\nhttps://jup.ag/swap/USDC-${transaction.address}\n\n@Furymuse`);
        }

        // Ensure transaction._id is passed as ObjectId
        await updateTransactionState(transaction._id, newState, usdcAmountSpent, tokenAmountReceived, {});
        console.log(`Transaction for address ${transaction.address} updated to ${newState}`);

        if (error) {
            console.error("Error during transaction confirmation:", error);
        }
    }
    return new_buy;
  } catch (error) {
    console.error('Error processing transactions:', error);
  }
}

async function processCompleteTransactions() {
  
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0'); // January is 0
  const year = today.getFullYear();
  const dateString = `${day}-${month}-${year}`;

  try {
    const completedTransactions = await get_transaction_by_date_and_state("completed", dateString);
    const balances = await getAllBalances(); // Assume this returns an object indexed by string addresses

    for (const transaction of completedTransactions) {
      const addressKey = transaction.address.toString(); // Convert String object to a primitive string
      const balance = balances[addressKey];

      // Log for debugging
      console.log("DEBUG: Transaction data:", transaction);

      // Check and log the entry price for debugging
      if (!transaction.entry_price || transaction.entry_price <= 0) {
        console.log(`Invalid entry price for transaction with address ${addressKey}:`, transaction.entry_price);
        continue; // Skip this transaction as it has invalid entry price
      }

      // Check if there is already an open order for this address
      const existingOrder = await getOpenOrderRecordByAddress(addressKey);
      if (existingOrder) {
        console.log(`Skipping creation of open order for ${addressKey} as it already exists.`);
        continue; // Skip to the next transaction if there's already an open order for this address
      }

      // Create a new open order only if the balance is sufficient and no order exists
      const STOP_LOSS_PERCENT_FROM_ENTRY = 1 - parseFloat(process.env.STOP_LOSS || "0.25");
      const TAKE_PROFIT_1_PERCENT_FROM_ENTRY = 1 + parseFloat(process.env.TAKE_PROFIT_PRICE_1 || "0.75");
      const TAKE_PROFIT_2_PERCENT_FROM_ENTRY = 1 + parseFloat(process.env.TAKE_PROFIT_PRICE_1 || "1.75");

      if (balance && balance >= 1) {
        const orderData: OpenOrder = {
          tx_date: transaction.tx_date,
          address: addressKey,
          symbol: transaction.symbol,
          usd_spent: transaction.usd_spent || 0,
          entry_price: transaction.entry_price,
          token_amount_received: transaction.token_amount_received || 0,
          stop_loss: transaction.entry_price * 0.25,
          TP_1: transaction.entry_price * 4,
          TP_2: transaction.entry_price * 8.75,
          price_change_percent: "",
          profit_and_loss: ""
        };
        await createOpenOrder(orderData);
        console.log(`Open order created for address ${addressKey}`);
      }
    }
  } catch (error) {
    console.error('Error processing complete transactions:', error);
  }
}

  /*
(async () => {

    await processCompleteTransactions();
    
})();
*/