import axios from 'axios';
import { swap_from_sol_to_token, swap_from_token_to_sol, pre_and_post_buy_operations, pre_and_post_sell_operations} from '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/jupiter_swap_STABLE_VERSION'
import { getAllBalances, getTokenBalance, refresh_SOL_and_USDC_balance, processTransactions, refresh_SOL_balance} from '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/my_wallet'
import { removePendingTransactions, repeatProcessTransactions } from '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/trade_manager';
import { amountToUiAmount } from '@solana/spl-token';
import csv from 'csv-parser';
import fs, { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { Parser } from 'json2csv';
import {update_account_PNL_v3} from '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/account_pnl';
import {checkOHLCVConditions} from '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/check_OHLCV';
import {get_token_price, get_token_prices} from '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/account_pnl';
import { format } from 'date-fns';
import {send_message} from './telegram_bot';
import { stringify } from 'csv-stringify/sync';
import { log } from 'console';




interface CsvRow {
    address: string;
    pairAddress: string;
    symbol: string;
}



const AMOUNT_USD_TO_BUY = 4;
const AMOUNT_SOL_TO_BUY = 0.0175;


async function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAmountInSOL(usdAmount: number): Promise<string> {
    const url = "https://public-api.birdeye.so/public/price?address=So11111111111111111111111111111111111111112";
    const headers = { "X-API-KEY": "eccc7565cb0c42ff85c19b64a640d41f" };
    
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

async function getAmountInUSD(solAmount: number): Promise<number> {
    //const url = "https://public-api.birdeye.so/public/price?address=So11111111111111111111111111111111111111112";
    //const headers = { "X-API-KEY": "eccc7565cb0c42ff85c19b64a640d41f" };
    
    try {
        //const response = await axios.get(url, { headers });
        //await delay(1000);
        //const solPrice = response.data.data.value;
        const solPrice = await get_token_price("So11111111111111111111111111111111111111112");
        console.log(`SOL Price: ${solPrice}`);

        // Calculate the amount in USD for the given amount of SOL
        const usdAmount = solAmount * solPrice;
        return usdAmount;
    } catch (error) {
        console.error("Error fetching SOL price", error);
        throw error;
    }
}

async function buy_manual(amount_usd: number, token_address: String) {

    //const amount_USD = await getAmountInUSD(amount_sol);
    
    return pre_and_post_buy_operations(amount_usd, 0.001, token_address, "");
    
}

async function buy_all_from_filtered() {
    console.log("DEBUG: starting buy_all_from_filtered()");

    let all_transactions_succeed = true;
    const logFilePath = '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/data_logs.csv';
    const filePath = '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/level_2_filter.csv';
    const exclusionFilePath = '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_tracker_final.csv';

    try {
        const balances = await getAllBalances();

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            console.log("The source csv file level_2_filter.csv is empty.\n");
            return;
        }
       
        const data: CsvRow[] = [];
        const stream = fs.createReadStream(filePath).pipe(csv());

        stream.on('data', (row: CsvRow) => data.push(row));
        await new Promise(resolve => stream.on('end', resolve));

        console.log("Checking for new Buy opportunities...");

        for (const row of data) {
            
            const balance = balances[row.address];
            console.log(`\nPerforming OHLCV checks on ${row.address}. Balance: ${balance}`);

            if ((balance && balance < 1) || !balance) {
                const canBuy = await checkOHLCVConditions(row.pairAddress);
                console.log(`OHLCV check result: ${canBuy}`);
                
                if (canBuy) {
                    try {
                        //const amount_sol_string = await getAmountInSOL(AMOUNT_USD_TO_BUY);
                        //const amount_sol = parseFloat(amount_sol_string);
                        const amount_SOL = await getAmountInSOL(AMOUNT_USD_TO_BUY);
                        

                        const result = pre_and_post_buy_operations(AMOUNT_USD_TO_BUY, parseFloat(amount_SOL), row.address, row.symbol);
                        all_transactions_succeed

                        if (!result) {
                            all_transactions_succeed = false;
                        }else {
                            
                        } 

                        await delay(1000); // Ensure a pause before processing the next token
                    } catch (error) {
                        console.error('Error during buy operation:', error);
                    }
                }
            } else {
                console.log("INFO: Wallet already holds that token, not Buying.");
                await delay(1000);
            }
        }
    } catch (error) {
        console.error('Error fetching balances:', error);
        return false;
    }

    if (all_transactions_succeed) {
        console.log('All transactions processed.');
        return true;
    } else {
        console.log('Some transactions failed.');
        return false;
    }
}



async function sell_all_for_address(tokenAddress: String, symbol: String) {
    const token_balance = await getTokenBalance(tokenAddress);

    //if (token_balance === undefined) {
    //    console.error('Token balance is undefined.');
     //   return; // Handle the undefined case appropriately
    //}
    if (token_balance) {
        await pre_and_post_sell_operations(token_balance, tokenAddress, "", "");
    }
    
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
    let totalUSDInvested = 0; // To accumulate the total USD value
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
            totalUSDInvested += usdValue; // Add to total USD invested
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
    console.log(`Sol balance: ${sol_balance}`);
    console.log(`Sol total in USD: ${sol_value_in_USD}`);
    console.log(`Tokens total in USD: ${totalUSDInvested}`);
    console.log(`Total USDC: $${USDC_value.toFixed(2)}`);
    totalUSDInvested += sol_value_in_USD;
    // Print the total amount of USD invested in the wallet
    
    console.log(`Total USD Invested: ${(totalUSDInvested + USDC_value).toFixed(2)}`);
    const telegram_message = `Sol balance: ${sol_balance}\nSol USD value: $${sol_value_in_USD.toFixed(2)}\nTotal USDC: $${USDC_value.toFixed(2)}\nTokens USD value: $${(totalUSDInvested - sol_value_in_USD).toFixed(2)}\n\n Total USD value: 🟢 $${(totalUSDInvested + USDC_value).toFixed(2)} 🟢`
    return telegram_message;
    
}

function buyWrapper() {
    async function buyTokens() {
        try {
            const result = await buy_all_from_filtered();
            //await update_pnl_after_buy();
            // Set the timeout only if the result is explicitly false
            if (result === true) {
                setTimeout(buyTokens, 90 * 1000); // Call again after 5 minutes
            }else {
                setTimeout(buyTokens, 15 * 1000);
            }
        } catch (error) {
            console.error("Error calling buy_all_from_filtered:", error);
        }
    }
    buyTokens();
}

function sellWrapper() {
    async function sellTokens() {
        try {
            const result = await update_account_PNL_v3();
            await printTokenBalancesInUSD();
            // Set the timeout only if the result is explicitly false
            if (result === true) {
                setTimeout(sellTokens, 10 * 1000); // Call again after 5 minutes
            }else {
                setTimeout(sellTokens, 1 * 1000);
            }
        } catch (error) {
            console.error("Error calling update_account_PNL:", error);
        }
    }
    sellTokens();
}

async function processBalances() {
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
                await pre_and_post_sell_operations(balance, address, "", "full liquidation");
            }
        }
        console.log("All operations completed successfully.");
    } catch (error) {
        console.error("An error occurred during processing:", error);
    }
}

function refresh_balance_in_telegram() {
    async function refreshBalance() {
        try {
            const telegram_message = await printTokenBalancesInUSD();
            if (telegram_message) {
                await send_message(telegram_message);
            }
            setTimeout(refreshBalance, 185 * 1000);
            
        } catch (error) {
            console.error("Error calling update_account_PNL:", error);
        }
    }
    refreshBalance();
}

//-----------------------------------------------------------------------------------------------------------------------------
// Command line Args logic


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
            pre_and_post_sell_operations(amountToken, tokenAddress, "", "manual sell");
        } else {
            console.log("Error: Insufficient arguments for 'sell'");
        }
        break;
    case "sell-all":
        processBalances();
        break;
    
   
    case "balance-in-usd":
        printTokenBalancesInUSD();
        break;    
      
    default:
        console.log("BUY-BOT: Invalid command. Please provide one of the following inputs: \n\n-> buy\n-> buy-from-filtered\n-> sol-amount\n-> sell\n-> sell-all");
        process.exit(1);
}