/*

* IMPORTANT *

For buys and sells, this script calls the buy and sell entry point for the code that works with the actual blochchain transactions;
The script for the blochchain transaction logic is:  jupiter_swap_STABLE_VERSION.ts  , and the buy and sell entry points that are called from here are:
    -pre_and_post_buy_operations()
    -pre_and_post_sell_operations()


 List of arguments for this script:

    "pnl":                      - Starts the seller  ->  trading_BOT.ts pnl
    "buy-from-filtered":        - Starts the buyer   ->  trading_BOT.ts buy-from-filtered
    "tg-balance":               - Starts the account ballance refresh on TG  ->  trading_BOT.ts tg-balance
    "tg-bot-start":             - Starts the TG bot for the TG chat commands  ->  trading_BOT.ts tg-bot-start
    "buy":                      - Buy manually   ->  trading_BOT.ts buy <tokenAddress> <usd_amount_toSpend>
    "sell":                     - Sell manually  ->  trading_BOT.ts sell <tokenAddress> <token_mount_toSell>
    "sell-all":                 - Start the process swaping all the tokens in the wallet into USDC (Except Sol) ->  trading_BOT.ts sell-all
    "balance-in-usd":           - Prints the ballance for all tokens, Sol, USDC, USDC + tokens, and total balances ->  balance-in-usd
    
*/

import dotenv from "dotenv";
import axios from 'axios';
import {manageOpenOrders} from './transaction_manager'
import { swap_from_sol_to_token, swap_from_token_to_sol, pre_and_post_sell_operations, pre_and_post_buy_operations_for_buy_manual, pre_and_post_buy_operations_v2, pre_and_post_sell_operations_v2} from '/root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/jupiter_swap_STABLE_VERSION'
import { getAllBalances, getTokenBalance, refresh_SOL_and_USDC_balance, processTransactions, refresh_SOL_balance} from '/root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/my_wallet'
import csv from 'csv-parser';
import fs, { readFileSync, writeFileSync } from 'fs';
import {checkOHLCVConditions} from '/root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/check_OHLCV';
import {get_token_price, get_token_prices} from '/root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/account_pnl';
import {send_message, start_bot} from './telegram_bot';
import {get_transaction_by_state, updateTransactionState, createOpenOrder, getOpenOrderRecordByAddress, getBuyTrackerRecordByAddress, getBuyTrackerRecordsByAddress} from "./mongoDB_connection"
import {processPendingTransactions} from './transaction_manager';

dotenv.config({ path: '/root/project/solana-trading-bot/jupiter-trading-bot/.env' });


const AMOUNT_SOL_TO_BUY = 0.0175;


async function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

interface TokenBalanceResult {
    message: string;
    totalUSDInvested: number;
}

async function getAmountInSOL(usdAmount: number): Promise<string> {
    const url = "https://public-api.birdeye.so/defi/price?address=So11111111111111111111111111111111111111112";
    const headers = { "X-API-KEY": "1368ab5cd35549da9d2111afa32c829f" };
    
    try {
        const response = await axios.get(url, { headers });
        const solPrice = response.data.data.value;
        //console.log(`SOL Price: ${solPrice}`);

        // Calculate the amount in SOL for the given USD amount and format to show only four decimal places
        const solAmount = (usdAmount / solPrice).toFixed(4);
        return solAmount;
    } catch (error) {
        console.error("Error fetching SOL price", error);
        throw error;
    }
}

//-----------------------------------------------------------------------------------------------------------------------------

async function getAmountInUSD(solAmount: number): Promise<number> {
    const url = "https://public-api.birdeye.so/defi/price?address=So11111111111111111111111111111111111111112";
    const headers = { "X-API-KEY": "1368ab5cd35549da9d2111afa32c829f" };
    
    
    try {
        const response = await axios.get(url, { headers });
        await delay(1000);
        const solPrice = response.data.data.value;
        //const solPrice = await get_token_price("So11111111111111111111111111111111111111112");
        console.log(`SOL Price: ${solPrice}`);

        // Calculate the amount in USD for the given amount of SOL
        const usdAmount = solAmount * solPrice;
        return usdAmount;
    } catch (error) {
        console.error("Error fetching SOL price", error);
        throw error;
    }
}

//-----------------------------------------------------------------------------------------------------------------------------
// Manual buy
//-----------------------------------------------------------------------------------------------------------------------------

async function buy_manual(amount_usd: number, token_address: String) {

    //const amount_USD = await getAmountInUSD(amount_sol);
    
    return pre_and_post_buy_operations_for_buy_manual(amount_usd, token_address, "");
    
}

//-----------------------------------------------------------------------------------------------------------------------------
// Called by buyWrapper loop
//-----------------------------------------------------------------------------------------------------------------------------
/*
async function buy_all_from_filtered(excludedAddresses = new Set()) {
    console.log("DEBUG: starting buy_all_from_filtered()");

    let all_transactions_succeed = true;
    const filePath = '/root/project/solana-trading-bot/data/level_1_filter.csv';
    const openOrdersFilePath = '/root/project/solana-trading-bot/data/open_orders_v2.csv'; // Path to open orders CSV file
    const csvHeaders = [
      'createdDateTime', 'address', 'symbol', 'pairAddress', 'buys_5m',
      'buys_1h', 'buys_6h', 'buys_24h', 'sells_5m', 'sells_1h',
      'sells_6h', 'sells_24h', 'volume_5m', 'volume_1h', 'volume_6h',
      'volume_24h', 'priceChange_5m', 'priceChange_1h', 'priceChange_6h',
      'priceChange_24h', 'liquidity', 'marketCap', 'priceUSD', 'website',
      'twitter', 'telegram'
    ];

    try {
        const balances = await getAllBalances();

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            console.log("The source csv file level_2_filter.csv is empty.\n");
            return true;
        }

        // Read the open orders file to get existing addresses
        const openOrdersAddresses = new Set();
        if (fs.existsSync(openOrdersFilePath) && fs.statSync(openOrdersFilePath).size > 0) {
            const openOrdersStream = fs.createReadStream(openOrdersFilePath).pipe(csv({ headers: csvHeaders }));
            for await (const order of openOrdersStream) {
                if (order.address && order.address.trim() !== '' && order.address !== 'address') {
                    openOrdersAddresses.add(order.address.trim());
                }
            }
        }

        const stream = fs.createReadStream(filePath).pipe(csv({ headers: csvHeaders }));

        for await (const row of stream) {
            // Skip rows with no address or with the placeholder "address"
            if (!row.address || row.address.trim() === '' || row.address === 'address') {
                console.log("Skipping row with invalid address.");
                continue;
            }

            if (openOrdersAddresses.has(row.address)) {
                console.log(`Skipping purchase for excluded or open order address ${row.address}`);
                continue;
            }

            const balance = balances[row.address];
            console.log(`Performing OHLCV checks on ${row.address}. Balance: ${balance}`);

            if ((balance && balance < 1) || balance === undefined) {
                const canBuy = await checkOHLCVConditions(row.pairAddress);
                console.log(`OHLCV check result: ${canBuy}`);

                if (canBuy) {
                    try {
                        const amount_SOL = await getAmountInSOL(AMOUNT_USD_TO_BUY);
                        const result = await pre_and_post_buy_operations(AMOUNT_USD_TO_BUY, parseFloat(amount_SOL), row.address, row.symbol);
                        if (!result) {
                            all_transactions_succeed = false;
                        }
                    } catch (error) {
                        console.error('Error during buy operation:', error);
                        all_transactions_succeed = false;
                    }
                }
            } else {
                console.log("INFO: Wallet already holds that token, not buying.");
            }

            // Delay to ensure a pause before processing the next token
            await delay(1000);
        }
    } catch (error) {
        console.error('Error fetching balances or reading CSV:', error);
        return false;
    }

    console.log(all_transactions_succeed ? 'All transactions processed.' : 'Some transactions failed.');
    return all_transactions_succeed;
}
*/
async function buy_all_from_filtered_v2() {
    console.log("DEBUG: starting buy_all_from_filtered_v2()");

    const filePath = '/root/project/solana-trading-bot/data/level_2_filter.csv';
    const csvHeaders = [
      'createdDateTime', 'address', 'symbol', 'pairAddress', 'buys_5m',
      'buys_1h', 'buys_6h', 'buys_24h', 'sells_5m', 'sells_1h',
      'sells_6h', 'sells_24h', 'volume_5m', 'volume_1h', 'volume_6h',
      'volume_24h', 'priceChange_5m', 'priceChange_1h', 'priceChange_6h',
      'priceChange_24h', 'liquidity', 'marketCap', 'priceUSD', 'website',
      'twitter', 'telegram'
    ];

    try {

        const sol_balance = await refresh_SOL_balance();
        if (sol_balance < 0.015) {
            console.log("\n\nSolana Balance is Low, buying more Solana...\n\n")
            await buy_manual(4, "So11111111111111111111111111111111111111112");
        }

        const balances = await getAllBalances();

        //const BalanceResult = await printTokenBalancesInUSD_v2();
        //const { message: telegram_message, totalUSDInvested } = BalanceResult;
        // Get the percent to invest from environment variable, or use default value if not set
        //const account_percent_toInvest = parseFloat(process.env.PERCENT_OF_ACCOUNT_TO_INVEST || "0.02");
        const AMOUNT_USD_TO_BUY = 10;

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            console.log("The source csv file level_1_filter.csv is empty.\n");
            return true;
        }

        const stream = fs.createReadStream(filePath).pipe(csv({ headers: csvHeaders }));

        for await (const row of stream) {
            if (!row.address || row.address.trim() === '' || row.address === 'address') {
                console.log("Skipping row with invalid address.");
                continue;
            }

            // Check if the address is in buy_tracker with tx_state "completed"
            const buyTrackerRecords = await getBuyTrackerRecordsByAddress(row.address);
            if (buyTrackerRecords.some(record => record.tx_state === "pending")) {
                console.log(`Skipping purchase for ${row.address} as it has records in buy_tracker with tx_state "pending".`);
                continue; // Skip this iteration if there is any record with the transaction completed or pending
            }

            const moment = require('moment'); // Ensure you have 'moment' library installed
            const threeHoursAgo = moment().subtract(3, 'hours');

            if (buyTrackerRecords.some(record => record.tx_state === "completed")) {
                    console.log(`Skipping purchase for ${row.address} as it has records in buy_tracker with tx_state "completed" and recent.`);
                    continue; // Skip this iteration if there is any record with the transaction completed and date is less than 3 hours ago
                }

            // Check if the address is in open_orders
            const openOrderRecord = await getOpenOrderRecordByAddress(row.address);
            if (openOrderRecord) {
                console.log(`Skipping purchase for ${row.address} as it exists in open_orders.`);
                continue; // Skip this iteration if the token is in open orders
            }

            const balance = balances[row.address];
            console.log(`Performing OHLCV checks on ${row.address}. Balance: ${balance}`);

            


            if ((balance && balance < 1) || balance === undefined) {
                const canBuy = await checkOHLCVConditions(row.pairAddress);
                console.log(`OHLCV check result: ${canBuy}`);

                if (canBuy) {
                    try {
                        const amount_SOL = await getAmountInSOL(AMOUNT_USD_TO_BUY); // Make sure AMOUNT_USD_TO_BUY is defined
                        const result = await pre_and_post_buy_operations_v2(AMOUNT_USD_TO_BUY, parseFloat(amount_SOL), row.address, row.symbol);
                        console.log(`Buy operation result for ${row.address}:`, result);
                    } catch (error) {
                        console.error('Error during buy operation:', error);
                    }
                }
            } else {
                console.log("INFO: Wallet already holds that token, not buying.");
            }

            // Delay to ensure a pause before processing the next token
            await delay(1000);
        }

        console.log("\n*** Processing pending transactions... ***\n")
        await processPendingTransactions();


    } catch (error) {
        console.error('Error fetching balances or reading CSV:', error);
        return false;
    }
}



//-----------------------------------------------------------------------------------------------------------------------------
//  Currently not used, but will be usefull for more control and flexibility
//-----------------------------------------------------------------------------------------------------------------------------

async function sell_all_for_address(tokenAddress: String, symbol: String) {
    const token_balance = await getTokenBalance(tokenAddress);

    if (token_balance) {
        await pre_and_post_sell_operations(token_balance, tokenAddress, "", "");
    }
    
}
//-----------------------------------------------------------------------------------------------------------------------------
//
//  Print list of token balances and:
//  
//  Sol balance
//  Sol total in USD
//  Total USDC
//  Total USD Invested
//  Trading total in USD
//
//-----------------------------------------------------------------------------------------------------------------------------
async function printTokenBalancesInUSD_v2(): Promise<TokenBalanceResult> {
    const balances = (await getAllBalances() || {}) as { [address: string]: number };
    const tokenAddresses = Object.keys(balances).filter(address => balances[address] > 0);

    if (tokenAddresses.length === 0) {
        console.log("No token balances to display.");
        return { message: "No token balances to display.", totalUSDInvested: 0 };  // Make sure to handle this undefined case in your calling function
    }

    const priceMap = await get_token_prices(tokenAddresses);
    let tokenValues: { tokenAddress: string; usdValue: number; balance: number; }[] = [];
    let tokens_USD_value = 0;
    let USDC_value = 0;
    for (const tokenAddress of tokenAddresses) {
        if (tokenAddress === "USDC_token_address") {  // Replace with actual USDC token address
            USDC_value = balances[tokenAddress];
            continue;
        }
        const balance = balances[tokenAddress];
        const price = priceMap.get(tokenAddress);
        if (balance > 0 && price !== undefined) {
            const usdValue = balance * price;
            tokens_USD_value += usdValue;
            tokenValues.push({ tokenAddress, usdValue, balance });
        }
    }

    const sol_balance = await refresh_SOL_balance();
    const sol_value_in_USD = await getAmountInUSD(sol_balance);
    const totalUSDInvested = (tokens_USD_value + USDC_value + sol_value_in_USD).toFixed(2);

    const telegram_message = `...`;  // Your previous message formatting here

    return { message: telegram_message, totalUSDInvested: parseFloat(totalUSDInvested) };
}


async function printTokenBalancesInUSD() {
    const balances = (await getAllBalances() || {}) as { [address: string]: number };

    // Get unique token addresses from the balances
    const tokenAddresses = Object.keys(balances).filter(address => balances[address] > 0);

    if (tokenAddresses.length === 0) {
        console.log("No token balances to display.");
        return;
    }

    // Get prices for all tokens
    const priceMap = await get_token_prices(tokenAddresses);

    let tokenValues: { tokenAddress: string; usdValue: number; balance: number; }[] = [];
    let tokens_USD_value = 0; // To accumulate the total USD value
    let USDC_value = 0;
    for (const tokenAddress of tokenAddresses) {
        if (tokenAddress == "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") {
            USDC_value = balances[tokenAddress];
            continue;
        }
        const balance = balances[tokenAddress];
        const price = priceMap.get(tokenAddress);
        if (balance > 0 && price !== undefined) {
            const usdValue = balance * price;
            tokens_USD_value += usdValue; // Add to total USD invested
            tokenValues.push({ tokenAddress, usdValue, balance });
        }
    }

    // Sort the tokens by their USD value in descending order
    tokenValues.sort((a, b) => b.usdValue - a.usdValue);

    // Print the tokens in order
    tokenValues.forEach(({ tokenAddress, usdValue, balance }) => {
        console.log(`Address: ${tokenAddress}: USD Value: ${usdValue.toFixed(2)}    Balance: ${balance}`);
    });
    const sol_balance = await refresh_SOL_balance();
    const sol_value_in_USD = await getAmountInUSD(sol_balance);
    const usdc_plus_tokens = (tokens_USD_value + USDC_value).toFixed(2);
    const totalUSDInvested = (tokens_USD_value + USDC_value + sol_value_in_USD).toFixed(2);
    console.log(`\nSol balance: ${sol_balance}\n`);

    console.log(`Sol total in USD: $${sol_value_in_USD.toFixed(2)}`);
    console.log(`Total USDC: $${USDC_value.toFixed(2)}`);
    console.log(`Total meme tokens: $${tokens_USD_value}\n`);
    console.log(`Total in USD: * $${totalUSDInvested} *\n`);
    
    //totalUSDInvested += sol_value_in_USD;
    // Print the total amount of USD invested in the wallet
    
    
    const telegram_message = `Sol balance: ${sol_balance}\nSol total in USD: $${sol_value_in_USD.toFixed(2)}\nTotal USDC: $${USDC_value.toFixed(2)}\nTotal meme tokens: $${tokens_USD_value.toFixed(2)}\n\n\nTotal in USD: 🟢 $${totalUSDInvested} 🟢`
    return telegram_message;
    
}

//-----------------------------------------------------------------------------------------------------------------------------
// Entry point for BUY logic
//-----------------------------------------------------------------------------------------------------------------------------

async function buyWrapper() {
    async function buyTokens() {
        try {

            const result = await buy_all_from_filtered_v2();
           
            setTimeout(buyTokens, 15 * 1000); // Retry after 5 minutes
        
        } catch (error) {
            console.error("Error calling buy_all_from_filtered:", error);
            setTimeout(buyTokens, 15 * 1000); // Retry after 1.5 minutes
        }
    }
    buyTokens();
}

//-----------------------------------------------------------------------------------------------------------------------------
// Entry point for SELL logic
//-----------------------------------------------------------------------------------------------------------------------------

function sellWrapper() {
    async function sellTokens() {
        try {
            const result = await manageOpenOrders();
            await printTokenBalancesInUSD();
            // Set the timeout only if the result is explicitly false
            
            setTimeout(sellTokens, 10 * 1000); // Call again after 5 minutes
        } catch (error) {
            console.error("Error calling update_account_PNL:", error);
            setTimeout(sellTokens, 10 * 1000);
        }
    }
    sellTokens();
}

//-----------------------------------------------------------------------------------------------------------------------------
// Swaps ALL tokens in the wallet to USDC (Escept Solana)
//-----------------------------------------------------------------------------------------------------------------------------

async function full_liquidation() {
    try {
        const allBalances = await getAllBalances();

        // Define the address to ignore
        const ignoreAddress = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

        // Convert the object into an array of entries and iterate over them
        for (const [address, balance] of Object.entries(allBalances)) {
            // Check if the current address should be ignored
            if (address === ignoreAddress) {
                continue; // Skip the rest of this loop iteration
            }

            if (balance && balance > 0) {  // Check if the balance is greater than zero and is defined
                pre_and_post_sell_operations(balance, address, "", "full liquidation");
                await delay(1000);
            }
        }
        console.log("All operations completed successfully.");
    } catch (error) {
        console.error("An error occurred during processing:", error);
    }
}

//-----------------------------------------------------------------------------------------------------------------------------
// Uses send_message from telegram_bot.ts
//-----------------------------------------------------------------------------------------------------------------------------

function refresh_balance_in_telegram() {
    async function refreshBalance() {
        try {
            const message = await printTokenBalancesInUSD();
            
            if (message) {
                await send_message(message);
            }
            setTimeout(refreshBalance, 300 * 1000);
        } catch (error) {
            console.error("Error in refreshBalance:", error);  // Corrected the error message to reflect the current function name
        }
    }
    refreshBalance();
}

//#######################################################################################################################
// Command line Args logic
//#######################################################################################################################

const args = process.argv.slice(2);

if (args.length < 1) {
    console.log("Usage: ts-node script_name.ts case_number [optional_arguments]");
    process.exit(1);
}
// Access the command-line argument
const arg1 = args[0];

// Switch case to call specific functions based on the argument value
switch (arg1) {

    
    case "buy":
        if (args.length >= 3) {
            const tokenAddress = args[1];
            const amountUSD = parseFloat(args[2]);
            buy_manual(amountUSD, tokenAddress)
        } else {
            console.log("Error: Insufficient arguments for 'sell'");
        }
        break;

    case "tg-balance":
        refresh_balance_in_telegram();
        break;
        
    case "tg-bot-start":
        start_bot();
        break;  

    case "buy-from-filtered":
        buyWrapper();
        break;


    case "pnl":
        sellWrapper();
        break;     

    case "sell":
        if (args.length >= 3) {
            const tokenAddress = args[1];
            const amountToken = parseFloat(args[2]);
            pre_and_post_sell_operations_v2(amountToken, tokenAddress, "", "manual sell");
        } else {
            console.log("Error: Insufficient arguments for 'sell'");
        }
        break;
    case "sell-all":
        full_liquidation();
        break;
    
   
    case "balance-in-usd":
        printTokenBalancesInUSD();
        break;    
      
    default:
        console.log("BUY-BOT: Invalid command. Please provide one of the following inputs: \n\n-> buy\n-> buy-from-filtered\n-> sol-amount\n-> sell\n-> sell-all");
        process.exit(1);
}