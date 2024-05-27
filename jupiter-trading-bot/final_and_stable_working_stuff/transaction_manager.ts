import axios from "axios";
import {
    get_transaction_by_state,
    updateTransactionState,
    createOpenOrder,
    get_transaction_by_date_and_state,
    getBuyTrackerRecordsByAddress,
    getAllOpenOrders,
    deleteOpenOrder,
    getBuyTrackerRecordByAddress,
    updateOpenOrderProfitAndLoss,
    insertSellTrackerDocument,
    getOpenOrderRecordByAddress,
    connectToDatabase,
    getDatabase,
    findActiveWallets_for_sell,
    findActiveWallets_for_buy,
    deactivateWallet_buyer,
    deactivateWallet_seller
} from "./mongoDB_connection";
import {
    getAllBalances,
    getAllBalances_v2,
    getTokenBalance,
    get_wallet_balances_in_usd_v2,
    get_wallet_balances_in_usd,
    update_wallet_balances,
    getSolPrice,
    getSolBalance
} from './my_wallet';
import {
    pre_and_post_sell_operations,
    pre_and_post_buy_operations_v2,
    pre_and_post_sell_operations_v2,
    pre_and_post_sell_operations_for_ACTIVE_wallets,
    pre_and_post_sell_operations_v2_emergency,
    pre_and_post_buy_operations_for_ACTIVATED_wallets,
    pre_and_post_buy_operations_for_buy_manual
} from './jupiter_swap_STABLE_VERSION';
import { send_message, send_message_to_private_group } from './telegram_bot';
import dotenv from "dotenv";
import { Keypair } from "@solana/web3.js";
import { createDecipheriv } from "crypto";
import { Db } from "mongodb";
import { get_token_prices_jupiter } from './my_wallet'
import { send_message_to_telegramId } from './telegram_public_sniper_bot'

export { process_sell, manageOpenOrders, processCompleteTransactions, processPendingTransactions }

import { logBuyAction, logFailedBuyAction } from './log_manager';

dotenv.config({ path: '/root/project/solana-trading-bot/jupiter-trading-bot/.env' });

const encryptionKey = process.env.ENCRYPTION_KEY!;
if (!encryptionKey || Buffer.from(encryptionKey).length !== 32) {
    console.error("Encryption key is not set correctly in the environment. It must be 32 bytes.");
    process.exit(1); // Exit if the encryption key is not set correctly
}

const decryptText = (text: string) => {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
};

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

async function process_sell(data: TokenToSellMongo, db: Db): Promise<void> {
    console.log("inside process_sell()")
    try {
        
        const openOrderRecord = await getOpenOrderRecordByAddress(data.address.toString(), db);
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

        const sell_price = data.profit_in_usd / data.token_amount_sold;
        let priceChangePercent = ((sell_price - openOrderRecord.entry_price) / openOrderRecord.entry_price) * 100;
        let alert_message = "";
        if (data.message.includes("SL")) {
            alert_message = data.message.includes("% SL reached")
                ? "Stop Loss"
                : "Stop Profit";
        } else {
            alert_message = data.message.toString();
        }

        await send_message_to_private_group(`🟢‼️✅ NEW SELL ALERT 🚨🟢🔥\n\n Sell Type: ${alert_message}\n\nProfit/Loss: ${priceChangePercent.toFixed(2)}%\n\nToken Symbol: ${openOrderRecord.symbol}\n\nToken address:\n\n${data.address}\n\nDexTools link:\nhttps://www.dextools.io/app/pt/solana/pair-explorer/${data.address}?t=1715524172090\n\nJupiter link:\nhttps://jup.ag/swap/${data.address}-USDC`);
        send_message(`🟢‼️✅ NEW SELL 🚨🟢🔥\n\n${data.message}\n\nSold:   ${data.token_amount_sold} ${openOrderRecord.symbol}\nUSDC received:   $${(profit_and_loss).toFixed(2)} USDC\n\nToken address:\n${data.address}\n\nDexTools link:\nhttps://www.dextools.io/app/pt/solana/pair-explorer/${data.address}?t=1713211991329\n\nSell link:\nhttps://jup.ag/swap/${data.address}-USDC\n\n@Furymuse`);

        await insertSellTrackerDocument(sellData, db);
        console.log(`Sell data for address ${data.address} inserted into sell_tracker collection.`);
    } catch (error) {
        console.error('Error processing sell:', error);
    }
}



function isOlderThanFiveDays(txDate: string): boolean {
    const [datePart, timePart] = txDate.split(' ');
    const [day, month, year] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    
    const orderDate = new Date(year, month - 1, day, hours, minutes, seconds);
    const currentDate = new Date();

    // Calculate the date 5 days ago from today
    const fiveDaysAgo = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 5);

    return orderDate <= fiveDaysAgo;
}

    const secretKey = process.env.SECRET_KEY ? JSON.parse(process.env.SECRET_KEY) : null;
    const wallet_main = Keypair.fromSecretKey(Uint8Array.from(secretKey));

async function manageOpenOrders(sniperbot_db: Db, sniperbot_tg_db: Db) {
    console.log("Starting new open order verification batch");

    

    const sol_price = await getSolPrice();
    const sol_balance = await getSolBalance(wallet_main.publicKey);

    console.log(`Solana balance: ${sol_balance}`);
    console.log(`Solana price: ${sol_price}`);

    /*
    if (sol_balance && sol_balance > 11 && sol_price && sol_price <= 160.70 && sol_price > 157) {
        await pre_and_post_sell_operations_v2(12.26, "So11111111111111111111111111111111111111112", "", "", sniperbot_db);
    }
    

    if (sol_balance && sol_balance < 3 && sol_price && sol_price <= 156 && sol_price > 150) {
        await pre_and_post_buy_operations_for_buy_manual(500, "So11111111111111111111111111111111111111112");
    }
    */

    const openOrders = await getAllOpenOrders(sniperbot_db);
    const addresses = openOrders.map(order => order.address.toString());

    //const priceMap = await get_token_prices_jupiter(addresses);
    const pricesMap = await get_token_prices(addresses);
    const balancesMap = await getAllBalances();

    for (const order of openOrders) {
        const currentPrice = pricesMap.get(order.address.toString());
        const currentBalance = balancesMap[order.address.toString()] || 0;

        if (currentBalance < 1) {
            await deleteOpenOrder(order.address.toString(), sniperbot_db);
            continue;
        }

        if (typeof currentPrice === 'undefined') {
            console.log(`Current price for address ${order.address} is undefined.`);
            continue;
        }

        let priceChangePercent = ((currentPrice - order.entry_price) / order.entry_price) * 100;
        let profitAndLoss = (currentBalance * currentPrice * priceChangePercent) / 100;

        const updateFields: UpdateFields = {
            price_change_percent: priceChangePercent.toFixed(2),
            profit_and_loss: profitAndLoss.toFixed(2)
        };

        if (!order.TP_1) {
            updateFields.stop_loss = order.entry_price * 2.50;
        }
        if (!order.TP_1 && !order.TP_2) {
            updateFields.stop_loss = order.entry_price * 5.75;
        }

        let message = "";
        if (currentPrice <= order.stop_loss) {
            console.log("Stop loss hit!!");
            console.log(`\NCURRENT PRICE: ${currentPrice}\nSTOP LOSS PRICE: ${order.stop_loss}`);
            send_message(`Stop Loss, about to sell ${order.address}\n\n@Furymuse`)
            if (currentPrice < order.entry_price) {
                message = `-75% SL reached!!`;
            } else {
                message = `Breakeaven SL reached!!`;
            }
            const result = await pre_and_post_sell_operations_v2(currentBalance, (order.address).toString(), (order.symbol).toString(), message, sniperbot_db);
            if (result) {
                
                await sell_for_active_wallets(order.address.toString(), 0, sniperbot_tg_db);
            }
            
        } else {
            if (order.TP_1 && currentPrice >= order.TP_1) {
                console.log("TP 1 hit!!!");
                send_message(`TP 1 hit, about to sell ${order.address}\n\n@Furymuse`)
                const result = await pre_and_post_sell_operations_v2((currentBalance * 0.7), (order.address).toString(), (order.symbol).toString(), "TP 1 reached!!", sniperbot_db);
                if (result) {
                    console.log("\nUpdating updateFields.TP_1 to null");
                    delay(3000);
                    updateFields.TP_1 = null;
                    updateFields.stop_loss = order.entry_price * 2.75
                    await sell_for_active_wallets(order.address.toString(), 1, sniperbot_tg_db);
                }
                
            }
            if (!order.TP_1 && order.TP_2 && currentPrice >= order.TP_2) {
                console.log("TP 2 hit!!!");
                send_message(`TP 2 hit, about to sell ${order.address}\n\n@Furymuse`)
                const result = await pre_and_post_sell_operations_v2((currentBalance * 0.7), (order.address).toString(), (order.symbol).toString(), "TP 2 reached!!", sniperbot_db);
                if (result) {
                
                    updateFields.TP_2 = null;
                    updateFields.stop_loss = order.entry_price * 5.25
                    await sell_for_active_wallets(order.address.toString(), 2, sniperbot_tg_db);
                }
                
            }
        }

        /*
        if (order.tx_date && isOlderThanFiveDays(order.tx_date)) {
            const result = await pre_and_post_sell_operations_v2((currentBalance), (order.address).toString(), (order.symbol).toString(), "max time limit", sniperbot_db);
                if (result) {
                
                    await sell_for_active_wallets(order.address.toString(), 0, sniperbot_tg_db);
                }
        }
        */
        
        await updateOpenOrderProfitAndLoss(order.address.toString(), updateFields, sniperbot_db);
    }
}

export async function sell_for_active_wallets(token_address: string, sell_type: number, db: Db) {
    console.log("Entering sell_for_active_wallets()");

    const activeWallets = await findActiveWallets_for_sell(db);
    if (!activeWallets || activeWallets.length === 0) {
        console.log("No active wallets.");
        return;
    }
    console.log(`There are ${activeWallets.length} active wallets.`);

    // Sequential processing of wallets with a delay
    for (const walletRecord of activeWallets) {
        try {
            console.log(`Processing wallet: ${walletRecord.walletAddress}`);

            const decryptedSecretKey = decryptText(walletRecord.secretKey);
            const secretKeyArray = JSON.parse(decryptedSecretKey);
            const wallet = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));

            const balances = await getAllBalances_v2(wallet);
            const balance = balances[token_address];
            if (!balance || balance < 1) {
                console.log("Insufficient token balance in this wallet:", walletRecord.walletAddress);
                await delay(3000);  // Delay to avoid rate limit issues
                continue;
            }

            let percentage_to_sell = sell_type === 0 ? 1 : (sell_type === 1 ? walletRecord.take_profit_1_amount : walletRecord.take_profit_2_amount);
            const token_amount_to_sell = balance * percentage_to_sell;

            let message = "";
            if(sell_type == 0) {
                message = "Stop Loss"
            }else if(sell_type == 1) {
                message = "Take Profit 1"
            }else if(sell_type == 2) {
                message = "Take Profit 2"
            }

            const total_balances = await get_wallet_balances_in_usd_v2(wallet);
            
            if (total_balances.sol_balance < 0.01 && total_balances.tokens_USD_value < 3) {
                console.log("Not enough Balance to invest");
                const result_seller = await deactivateWallet_seller(walletRecord.telegramId, db);
                const result_buyer = await deactivateWallet_buyer(walletRecord.telegramId, db);
                return;
            }
            if (total_balances.sol_balance! < 0.01 && total_balances.tokens_USD_value >= 3) {
                await pre_and_post_buy_operations_for_ACTIVATED_wallets(3, "So11111111111111111111111111111111111111112", wallet, walletRecord.telegramId);
                
            } 

            const signature = await pre_and_post_sell_operations_v2_emergency(token_amount_to_sell, token_address, message, wallet, walletRecord.telegramId);

            if (signature) {
                
                console.log(`Sell Swap transaction sent for wallet: ${walletRecord.walletAddress}`);
                break;
            } else {
                    console.log(`Failed to send swap transaction ${walletRecord.walletAddress}, retrying...`);
            }

            
        } catch (error) {
            console.error(`Error during sell operation for wallet ${walletRecord.walletAddress}:`, error);
        }

        await delay(3000);  // Delay before processing the next wallet
    }

    console.log("All sell operations completed.");
}

export async function get_token_price(tokenAddress: String): Promise<number> {
    const url = `https://public-api.birdeye.so/defi/price?address=${tokenAddress}`;
    const headers = { "X-API-KEY": process.env.BIRDEYE_API_KEY_3 };

    try {
        await delay(2000)
        const response = await axios.get(url, { headers });
        const tokenPrice = response.data?.data?.value;
        if (tokenPrice !== undefined) {
            return tokenPrice;
        } else {
            throw new Error("Token price not available in API response");
        }
    } catch (error) {
        console.error("Error fetching token price", error);
        throw error;
    }
}

export async function get_token_prices(tokenAddresses: string[]): Promise<Map<string, number>> {
    const MAX_ADDRESSES_PER_CALL = 30;
    const priceMap = new Map<string, number>();

    for (let i = 0; i < tokenAddresses.length; i += MAX_ADDRESSES_PER_CALL) {
        const chunk = tokenAddresses.slice(i, i + MAX_ADDRESSES_PER_CALL);
        const joinedAddresses = chunk.join('%2C');
        const url = `https://public-api.birdeye.so/defi/multi_price?list_address=${joinedAddresses}`;
        const headers = { "X-API-KEY": process.env.BIRDEYE_API_KEY_3 };

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
        }
    }

    return priceMap;
}

export async function waitForTransactionConfirmation(signature: string, tokenAddress: string, usdcMintAddress: string): Promise<{ tokenAmountReceived: number, usdcAmountSpent: number, error: any }> {
    console.log(`Waiting for transaction confirmation for signature: ${signature}`);
    let tokenAmountReceived: number = 0;
    let usdcAmountSpent: number = 0;
    let error: any = null;
    let delayTime = 13000;
    const maxAttempts = 6;
    let attempts = 0;

    const apiKey = '9ba9abe4-5382-46d3-9c67-680bd831ea14';
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
                    break;
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

async function processPendingTransactions(amount_usd: number, db: Db) {

    await connectToDatabase();
    
    const sniperbot_db = getDatabase("sniperbot");
    const sniperbot_tg_db = getDatabase("sniperbot-tg");

    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 1000;
    let new_buy = false;
    try {
        const pendingTransactions = await get_transaction_by_state("pending", db);
        for (const transaction of pendingTransactions) {
            const { tokenAmountReceived, usdcAmountSpent, error } = await waitForTransactionConfirmation(transaction.signature, transaction.address.toString(), "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

            let newState = "failed";



            if (tokenAmountReceived > 0 && usdcAmountSpent > 0 && (!error || error === null || error === undefined || error === "")) {
                const entry_price = usdcAmountSpent / tokenAmountReceived;
                newState = "completed";
                new_buy = true;


                await logBuyAction("Main wallet", usdcAmountSpent.toString(), transaction.address.toString());

                await send_message_to_private_group(`🟢‼️✅ NEW BUY ALERT 🚨🟢🔥\n\nEntry Price: ${entry_price}\nToken Symbol: ${transaction.symbol}\n\nToken address:\n\n${transaction.address}\n\nDexTools link:\nhttps://www.dextools.io/app/pt/solana/pair-explorer/${transaction.address}?t=1715524172090\n\nJupiter link:\nhttps://jup.ag/swap/USDC-${transaction.address}`);
                await send_message(`🟢‼️✅ NEW BUY 🚨🟢🔥\n\nSpent: $${usdcAmountSpent.toFixed(2)} USDC\nGot: ${tokenAmountReceived.toFixed(2)} ${transaction.symbol}\n\nToken address\n\n${transaction.address}\n\nDexTools link:\nhttps://www.dextools.io/app/pt/solana/pair-explorer/${transaction.address}?t=1713211991329\n\nBuy link:\nhttps://jup.ag/swap/USDC-${transaction.address}\n\n@Furymuse`);

                await retryBuyForActiveWallets((transaction.address).toString(), sniperbot_tg_db, MAX_RETRIES, RETRY_DELAY_MS);

            } else if (error) {
                console.error("Error during transaction confirmation:", error);
                await logFailedBuyAction("Main Wallet", usdcAmountSpent.toString(), transaction.address.toString(), `Error catched processPendingTransactions:\nError during transaction confirmation: ${error}`);
                // If failed, retry by calling pre_and_post_buy_operations_v2 again
                const amount_usd = transaction.usd_spent; // or any logic to determine the USD amount to retry with
                

                await pre_and_post_buy_operations_v2(amount_usd!, transaction.address, transaction.symbol, db);
            }

            await updateTransactionState(transaction._id, newState, usdcAmountSpent, tokenAmountReceived, {}, db);
            console.log(`Transaction for address ${transaction.address} updated to ${newState}`);
        }
        return new_buy;
    } catch (error) {
        console.error('Error processing transactions:', error);
        await logFailedBuyAction("Main Wallet", "no info available", "no info available", `Error catched processPendingTransactions:\nError processing transactions: ${error}`);
        
    }
}

async function processCompleteTransactions(db: Db) {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateString = `${day}-${month}-${year}`;

    try {
        const completedTransactions = await get_transaction_by_date_and_state("completed", dateString, db);
        const balances = await getAllBalances();

        for (const transaction of completedTransactions) {
            const addressKey = transaction.address.toString();
            const balance = balances[addressKey];

            console.log("DEBUG: Transaction data:", transaction);

            if (!transaction.entry_price || transaction.entry_price <= 0) {
                console.log(`Invalid entry price for transaction with address ${addressKey}:`, transaction.entry_price);
                continue;
            }

            const existingOrder = await getOpenOrderRecordByAddress(addressKey, db);
            if (existingOrder) {
                console.log(`Skipping creation of open order for ${addressKey} as it already exists.`);
                continue;
            }

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
                    stop_loss: transaction.entry_price * 0.39,
                    TP_1: transaction.entry_price * 4.75,
                    TP_2: transaction.entry_price * 8.90,
                    price_change_percent: "",
                    profit_and_loss: ""
                };
                await createOpenOrder(orderData, db);
                console.log(`Open order created for address ${addressKey}`);
            }
        }
    } catch (error) {
        console.error('Error processing complete transactions:', error);
    }
}


export async function sell_all(percentage_to_sell: number, wallet: Keypair, telegramId: string) {
    try {

      const balances = await get_wallet_balances_in_usd_v2(wallet);  
      
  
      const ignoreAddress = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const promises = [];
  
      for (const [address, { balance }] of Object.entries(balances.tokenValueMap)) {
        if (address === ignoreAddress) {
            continue;
        }
  
        console.log(`preparing to sell ${balance! * percentage_to_sell} of ${address}`);
        const token_amount_to_sell = balance! * percentage_to_sell;
  
        if (token_amount_to_sell && token_amount_to_sell >= 1) {
          const sellPromise = pre_and_post_sell_operations_v2_emergency(token_amount_to_sell, address, `Sell all tokens for ${percentage_to_sell * 100}%`, wallet, telegramId)
            .catch(error => {
              console.error("Error during sell operation for token address:", address, error);
              // Optionally, re-enqueue or handle error specifically
            });
          promises.push(sellPromise);
  
          await delay(3000); // Add delay between starting each operation
        }
      }
  
      // Wait for all operations to complete
      await Promise.all(promises);
      console.log("All operations completed successfully.");

    
    } catch (error) {
      console.error("An error occurred during processing:", error);
    }
  }

  export async function sell_group(usd_value: number, percentage_to_sell: number, wallet: Keypair, telegramId: string) {
    try {

        const balances = await get_wallet_balances_in_usd_v2(wallet);  
        
    
        const ignoreAddress = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
        const promises = [];
    
        for (const [address, { balance, usdValue }] of Object.entries(balances.tokenValueMap)) {

            if (address === ignoreAddress || usdValue < usd_value) {
                continue;
            }
          
    
          console.log(`preparing to sell ${balance! * percentage_to_sell} of ${address}`);
          const token_amount_to_sell = balance! * percentage_to_sell;
    
          if (token_amount_to_sell && token_amount_to_sell >= 1) {
            const sellPromise = pre_and_post_sell_operations_v2_emergency(token_amount_to_sell, address, `Sell all tokens for ${percentage_to_sell * 100}%`, wallet, telegramId)
              .catch(error => {
                console.error("Error during sell operation for token address:", address, error);
                // Optionally, re-enqueue or handle error specifically
              });
            promises.push(sellPromise);
    
            await delay(3000); // Add delay between starting each operation
          }
        }
    
        // Wait for all operations to complete
        await Promise.all(promises);
        console.log("All operations completed successfully.");
  
      
      } catch (error) {
        console.error("An error occurred during processing:", error);
      }
    }
  

  export async function sell_all_main_wallet(precentage_to_sell: number, db: Db) {
    try {
        const allBalances = await getAllBalances();
  
        const ignoreAddress = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  
        for (const [address, balance] of Object.entries(allBalances)) {
            if (address === ignoreAddress) {
                continue;
            }
            
            if (balance && balance > 0) {
                pre_and_post_sell_operations_v2(balance * precentage_to_sell, address, "", "", db);
                await delay(1000);
            }
        }
        console.log("All operations completed successfully.");
    } catch (error) {
        console.error("An error occurred during processing:", error);
    }
  }  


  export async function get_token_prices_v2(tokenAddresses: string[]): Promise<Map<string, number>> {
    const MAX_ADDRESSES_PER_CALL = 30;
    const priceMap = new Map<string, number>();

    for (let i = 0; i < tokenAddresses.length; i += MAX_ADDRESSES_PER_CALL) {
        const chunk = tokenAddresses.slice(i, i + MAX_ADDRESSES_PER_CALL);
        const joinedAddresses = chunk.join('%2C');
        const url = `https://public-api.birdeye.so/defi/multi_price?list_address=${joinedAddresses}`;
        const headers = { "X-API-KEY": process.env.BIRDEYE_API_KEY_3 };

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
        }
    }

    return priceMap;
}

export async function retryBuyForActiveWallets(address: string, sniperbot_tg_db: Db, maxRetries: number, delayMs: number) {
    let retries = 0;
    let success = false;

    while (retries < maxRetries && !success) {
        try {
            await buy_for_active_wallets(1, address, sniperbot_tg_db);
            success = true;
        } catch (error) {
            retries++;
            console.error(`Error during buy_for_active_wallets attempt ${retries}/${maxRetries}:`, error);
            if (retries < maxRetries) {
                console.log(`Retrying in ${delayMs}ms...`);
                await delay(delayMs);
            } else {
                console.error(`Max retries reached for ${address}. Moving on.`);
            }
        }
    }
}

async function buy_for_active_wallets(amount_usd: number, token_address: string, db: Db) {
    console.log("Initializing the manual buy...");

    const activeWallets = await findActiveWallets_for_buy(db);
    

    if (!activeWallets || activeWallets.length === 0) {
        console.log("\nNo active wallets.");
        return;
    } else {
        console.log("\nAt least one wallet is active.");
    }

    console.log("\nEntering loop for Active wallets.");

    const buyOperations = activeWallets.map(async (walletRecord, i) => {
        try {
            console.log(`Processing wallet ${i + 1} of ${activeWallets.length}: ${walletRecord.walletAddress}`);

            
            const decryptedSecretKey = decryptText(walletRecord.secretKey);

            if (!decryptedSecretKey) {
                throw new Error("Failed to decrypt secret key");
            }

            await delay(1000);

            
            const secretKeyArray = JSON.parse(decryptedSecretKey);

            await delay(1000);

            
            const wallet = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
            
            await delay(1000);

            if (wallet.publicKey.toBase58() !== walletRecord.walletAddress) {
                console.error("Mismatch between constructed wallet public key and expected wallet address");
                return;
            }

            console.log(`\nGetting balances for wallet: ${wallet.publicKey.toBase58()}`);
            const balances = await getAllBalances_v2(wallet);
            console.log("Balances fetched:", balances);

            const balance = balances[token_address.toString()];
            if (balance && balance > 1) {
                console.log("Wallet already has this token, not buying.");
                return;
            }

            console.log("Buying token for wallet!");
            const total_balances = await get_wallet_balances_in_usd_v2(wallet);
            

            const totalUSDInvested = typeof total_balances.totalUSDInvested === 'string' ? parseFloat(total_balances.totalUSDInvested) : total_balances.totalUSDInvested;
            console.log("Total USD Invested:", totalUSDInvested);

            const amount_usd_to_invest = total_balances.USDC_value * walletRecord.account_percent_to_invest;

            if (total_balances.sol_balance < 0.005 && totalUSDInvested < 3) {
                console.log("Not enough Balance to invest");
                return;
            }else if (total_balances.sol_balance < 0.005 && totalUSDInvested < 3) {
                console.log("Not enough Balance to invest");
                return;
            }
            else if (total_balances.sol_balance < 0.005 && totalUSDInvested > 3) {
                await pre_and_post_buy_operations_for_ACTIVATED_wallets(3, "So11111111111111111111111111111111111111112", wallet, walletRecord.telegramId);
                
            }

    
            const signature = await pre_and_post_buy_operations_for_ACTIVATED_wallets(amount_usd_to_invest, token_address.toString(), wallet, walletRecord.telegramId);
            if(signature) {

                console.log(`Swap transaction send with success for wallet ${wallet}\nn Signature_ ${signature}`);
                    
            }
            
            
        } catch (swapError) {
            console.error(`Swap operation failed for wallet ${walletRecord.walletAddress}:`, swapError);
        } 
    });

    await Promise.all(buyOperations);
    console.log("All swap operations completed.");
}