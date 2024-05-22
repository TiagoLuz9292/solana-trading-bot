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
import csv from 'csv-parser';
import fs from 'fs';
import { createDecipheriv } from "crypto";
import { Keypair } from "@solana/web3.js";
import moment from 'moment'; // Ensure you have 'moment' library installed
import { send_message_to_telegramId, start_tg_sniper_bot } from './telegram_public_sniper_bot'

import { manageOpenOrders, processCompleteTransactions, processPendingTransactions, sell_for_active_wallets, sell_all, sell_all_main_wallet } from './transaction_manager';
import { 
    swap_from_sol_to_token, 
    swap_from_token_to_sol, 
    pre_and_post_sell_operations, 
    pre_and_post_buy_operations_for_buy_manual, 
    pre_and_post_buy_operations_v2, 
    pre_and_post_sell_operations_v2, 
    pre_and_post_buy_operations_for_ACTIVATED_wallets,
    pre_and_post_sell_operations_for_ACTIVE_wallets,
    pre_and_post_buy_operations_v2_emergency,
    pre_and_post_sell_operations_v2_emergency
} from '/root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/jupiter_swap_STABLE_VERSION';

import { 
    getAllBalances, 
    getTokenBalance, 
    refresh_SOL_and_USDC_balance, 
    processTransactions, 
    refresh_SOL_balance, 
    get_wallet_balances_in_usd, 
    getAllBalances_v2, 
    get_wallet_balances_in_usd_v2,
    sell_token
} from '/root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/my_wallet';

import { checkOHLCVConditions } from '/root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/check_OHLCV';
import { get_token_price, get_token_prices } from '/root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/transaction_manager';
import { send_message, start_bot, send_message_to_private_group } from './telegram_bot';
import { 
    getOpenOrderRecordByAddress, 
    getBuyTrackerRecordsByAddress, 
    findActiveWallets, 
    connectToDatabase,
    getDatabase
} from "./mongoDB_connection";
import { Db } from "mongodb";

dotenv.config({ path: '/root/project/solana-trading-bot/jupiter-trading-bot/.env' });

const encryptionKey = process.env.ENCRYPTION_KEY!;
if (!encryptionKey || Buffer.from(encryptionKey).length !== 32) {
    console.error("Encryption key is not set correctly in the environment. It must be 32 bytes.");
    process.exit(1); // Exit if the encryption key is not set correctly
}

const decryptText = (text: string) => {
    console.log("\nInside decryptText()")
    console.log("\ngetting text parts")
    const textParts = text.split(':');
    console.log("\ngetting iv")
    const iv = Buffer.from(textParts.shift()!, 'hex');
    console.log("\ngetting encrypted text")
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    console.log("\ngetting decipher")
    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey), iv);
    console.log("\ngetting decrypted")
    let decrypted = decipher.update(encryptedText);
    console.log("\ngetting decrypted")
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
};

async function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

interface TokenBalanceResult {
    message: string;
    totalUSDInvested: number;
}

async function getAmountInSOL(usdAmount: number): Promise<string> {
    const url = "https://public-api.birdeye.so/defi/price?address=So11111111111111111111111111112111111111111";
    const headers = { "X-API-KEY": "cf15975d7aaf402fbac45058e252960e" };
    
    try {
        const response = await axios.get(url, { headers });
        const solPrice = response.data.data.value;

        // Calculate the amount in SOL for the given USD amount and format to show only four decimal places
        const solAmount = (usdAmount / solPrice).toFixed(4);
        return solAmount;
    } catch (error) {
        console.error("Error fetching SOL price", error);
        throw error;
    }
}

async function getAmountInUSD(solAmount: number): Promise<number> {
    const url = "https://public-api.birdeye.so/defi/price?address=So11111111111111111111111111111111111111112";
    const headers = { "X-API-KEY": "cf15975d7aaf402fbac45058e252960e" };
    
    try {
        const response = await axios.get(url, { headers });
        await delay(1000);
        const solPrice = response.data.data.value;

        console.log(`SOL Price: ${solPrice}`);

        // Calculate the amount in USD for the given amount of SOL
        const usdAmount = solAmount * solPrice;
        return usdAmount;
    } catch (error) {
        console.error("Error fetching SOL price", error);
        throw error;
    }
}



async function buy_all_from_filtered_v2(sniperbot_db: Db, sniperbot_tg_db: Db) {
    console.log("DEBUG: starting buy_all_from_filtered_v2()");
  
    const filePath = '/root/project/solana-trading-bot/data/tokens_to_buy.csv';
    const csvHeaders = [
        'createdDateTime', 'address', 'symbol', 'pairAddress', 'buys_5m',
        'buys_1h', 'buys_6h', 'buys_24h', 'sells_5m', 'sells_1h',
        'sells_6h', 'sells_24h', 'volume_5m', 'volume_1h', 'volume_6h',
        'volume_24h', 'priceChange_5m', 'priceChange_1h', 'priceChange_6h',
        'priceChange_24h', 'liquidity', 'marketCap', 'priceUSD', 'website',
        'twitter', 'telegram'
    ];

    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 1000;

    try {
        const sol_balance = await refresh_SOL_balance();
        if (sol_balance < 0.015) {
            console.log("\n\nSolana Balance is Low, buying more Solana...\n\n");
            await buy_manual(4, "So11111111111111111111111111111111111111112");
        }

        const balances = await getAllBalances();

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            console.log("The source csv file level_2_filter.csv is empty.\n");
            return true;
        }

        const stream = fs.createReadStream(filePath).pipe(csv({ headers: csvHeaders }));

        for await (const row of stream) {
            if (!row.address || row.address.trim() === '' || row.address === 'address') {
                console.log("Skipping row with invalid address.");
                continue;
            }

            console.log(`Performing OHLCV checks on ${row.address}`);
            const canBuy = await checkOHLCVConditions(row.pairAddress);
            console.log(`OHLCV check result: ${canBuy}`);

            if (canBuy) {
                try {
                    console.log("Before retryBuyForActiveWallets()");
                    await retryBuyForActiveWallets(row.address, sniperbot_tg_db, MAX_RETRIES, RETRY_DELAY_MS);
                    console.log(`Finished buys for associated wallets!`);
                } catch (error) {
                    console.error('Error during buy operation:', error);
                }
            }


            const buyTrackerRecords = await getBuyTrackerRecordsByAddress(row.address, sniperbot_db);
            if (buyTrackerRecords.some(record => record.tx_state === "pending")) {
                console.log(`Skipping purchase for ${row.address} as it has records in buy_tracker with tx_state "pending".`);
                continue;
            }

            if (buyTrackerRecords.some(record => record.tx_state === "completed")) {
                console.log(`Skipping purchase for ${row.address} as it has records in buy_tracker with tx_state "completed".`);
                continue;
            }

            const openOrderRecord = await getOpenOrderRecordByAddress(row.address, sniperbot_db);
            const balance = balances[row.address];
            
           

            if (canBuy) {
                if ((balance && balance < 1) || balance === undefined && !openOrderRecord) {
                    const secretKey = process.env.SECRET_KEY ? JSON.parse(process.env.SECRET_KEY) : null;
                    const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
                    const walletBalances = await get_wallet_balances_in_usd(wallet);
                    const accountPercentToInvest = parseFloat(process.env.PERCENT_OF_ACCOUNT_TO_INVEST || "0.025");
                    console.log(`percent to invest: ${accountPercentToInvest}`);
                    const amountUSDToBuy = walletBalances.USDC_value * accountPercentToInvest;
                    console.log(`amount to buy: ${amountUSDToBuy}`);

                    try {
                        console.log("Before pre_and_post_buy_operations_v2()");
                        const result = await pre_and_post_buy_operations_v2(amountUSDToBuy, row.address, row.symbol, sniperbot_db);
                        console.log(`Buy operation result for ${row.address}:`, result);
                    } catch (error) {
                        console.error('Error during buy operation:', error);
                    }
        
                    await delay(1000);

                } else {
                    console.log("INFO: Wallet already holds that token, not buying.");
                }
            }

           
        }

        console.log("\n*** Processing pending transactions... ***\n");
        const result = await processPendingTransactions(sniperbot_db);

        if (result) {
            console.log("New buy! Updating open_orders!!");
            await processCompleteTransactions(sniperbot_db);
        } else {
            console.log("No new buy, skipping processCompleteTx.");
        }

    } catch (error) {
        console.error('Error fetching balances or reading CSV:', error);
        return false;
    }

    return true;
}

async function retryBuyForActiveWallets(address: string, sniperbot_tg_db: Db, maxRetries: number, delayMs: number) {
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

async function sell_all_for_address(tokenAddress: String, symbol: String) {
    const token_balance = await getTokenBalance(tokenAddress);

    if (token_balance) {
        await pre_and_post_sell_operations(token_balance, tokenAddress, "", "");
    }
}

export async function printTokenBalancesInUSD_v2() {
    const secretKey = process.env.SECRET_KEY ? JSON.parse(process.env.SECRET_KEY) : null;
    const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

    const balances = await get_wallet_balances_in_usd_v2(wallet);

    const sol_balance = balances.sol_balance;
    const sol_value_in_USD = balances.sol_value_in_USD;
    const USDC_value = balances.USDC_value;
    const tokens_USD_value = balances.tokens_USD_value;
    const totalUSDInvested = typeof balances.totalUSDInvested === 'string' ? parseFloat(balances.totalUSDInvested) : balances.totalUSDInvested; // Ensure it's a number

    console.log(`\nSol balance: ${sol_balance}\n`);

    console.log(`Sol total in USD: $${sol_value_in_USD.toFixed(2)}`);
    console.log(`Total USDC: $${USDC_value.toFixed(2)}`);
    console.log(`Total meme tokens: $${tokens_USD_value.toFixed(2)}\n`);


    const tiago_percent=0.4504;
    const daniel_percent=0.4125;
    const sergiu_percent=0.1373;
    


    console.log("********************");
    console.log(`Tiago  -> $${(totalUSDInvested * tiago_percent).toFixed(2)}`);
    console.log(`Daniel -> $${(totalUSDInvested * daniel_percent).toFixed(2)}`);
    console.log(`Sergio -> $${(totalUSDInvested * sergiu_percent).toFixed(2)}`);
    console.log("********************\n\n");
    console.log(`Total in USD: * $${totalUSDInvested} *\n`);

    const telegram_message = `Sol balance: ${sol_balance}\nSol total in USD: $${sol_value_in_USD.toFixed(2)}\nTotal USDC: $${USDC_value.toFixed(2)}\nTotal meme tokens: $${tokens_USD_value.toFixed(2)}\n\n********************\n\nTiago  -> $${(totalUSDInvested * tiago_percent).toFixed(2)}\nDaniel -> $${(totalUSDInvested * daniel_percent).toFixed(2)}\nSergio -> $${(totalUSDInvested * sergiu_percent).toFixed(2)}\n\n********************\n\nTotal in USD: 🟢 $${totalUSDInvested} 🟢`;
    return telegram_message;
}

async function printTokenBalancesInUSD() {
    const balances = (await getAllBalances() || {}) as { [address: string]: number };
    const tokenAddresses = Object.keys(balances).filter(address => balances[address] > 0);

    if (tokenAddresses.length === 0) {
        console.log("No token balances to display.");
        return;
    }

    const priceMap = await get_token_prices(tokenAddresses);

    let tokenValues: { tokenAddress: string; usdValue: number; balance: number; }[] = [];
    let tokens_USD_value = 0;
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
            tokens_USD_value += usdValue;
            tokenValues.push({ tokenAddress, usdValue, balance });
        }
    }

    tokenValues.sort((a, b) => b.usdValue - a.usdValue);

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

    console.log("********************");
    console.log(`Tiago  -> $${(parseFloat(totalUSDInvested) * 0.4957).toFixed(2)}`);
    console.log(`Daniel -> $${(parseFloat(totalUSDInvested) * 0.3517).toFixed(2)}`);
    console.log(`Sergio -> $${(parseFloat(totalUSDInvested) * 0.1529).toFixed(2)}`);
    console.log("********************\n\n");
    console.log(`Total in USD: * $${totalUSDInvested} *\n`);

    const telegram_message = `Sol balance: ${sol_balance}\nSol total in USD: $${sol_value_in_USD.toFixed(2)}\nTotal USDC: $${USDC_value.toFixed(2)}\nTotal meme tokens: $${tokens_USD_value.toFixed(2)}\n\n********************\n\nTiago  -> $${(parseFloat(totalUSDInvested) * 0.4957).toFixed(2)}\nDaniel -> $${(parseFloat(totalUSDInvested) * 0.3517).toFixed(2)}\nSergio -> $${(parseFloat(totalUSDInvested) * 0.1529).toFixed(2)}\n\n********************\n\nTotal in USD: 🟢 $${totalUSDInvested} 🟢`;
    return telegram_message;
}

async function buyWrapper(sniperbot_db: Db, sniperbot_tg_db: Db) {

    
    async function buyTokens() {
        try {
            const result = await buy_all_from_filtered_v2(sniperbot_db, sniperbot_tg_db);
            setTimeout(buyTokens, 15 * 1000); // Retry after 5 minutes
        } catch (error) {
            console.error("Error calling buy_all_from_filtered:", error);
            setTimeout(buyTokens, 15 * 1000); // Retry after 1.5 minutes
        }
    }
    buyTokens();
}

function sellWrapper(sniperbot_db: Db, sniperbot_tg_db: Db) {
    

    async function sellTokens() {
        try {
            const result = await manageOpenOrders(sniperbot_db, sniperbot_tg_db);
            setTimeout(sellTokens, 20 * 1000); // Call again after 5 minutes
        } catch (error) {
            console.error("Error calling update_account_PNL:", error);
            setTimeout(sellTokens, 20 * 1000);
        }
    }
    sellTokens();
}

async function full_liquidation(precentage_to_sell: number, db: Db) {

    await sell_all_main_wallet(precentage_to_sell, db);
    
}

function refresh_balance_in_telegram() {
    async function refreshBalance() {
        try {
            const message = await printTokenBalancesInUSD_v2();
            if (message) {
                await send_message(message);
            }
            setTimeout(refreshBalance, 300 * 1000);
        } catch (error) {
            console.error("Error in refreshBalance:", error);
        }
    }
    refreshBalance();
}

const args = process.argv.slice(2);

if (args.length < 1) {
    console.log("Usage: ts-node script_name.ts case_number [optional_arguments]");
    process.exit(1);
}

const arg1 = args[0];

async function main() {
    await connectToDatabase();
    
    const sniperbot_db = getDatabase("sniperbot");
    const sniperbot_tg_db = getDatabase("sniperbot-tg");

    switch (arg1) {
        

        case "tg-balance":
            refresh_balance_in_telegram();
            break;
            
        case "tg-bot-start":
            start_bot();
            break;  

        case "tg-sniper-bot-start":
            start_tg_sniper_bot();
            break;      

        case "buy-from-filtered":
            buyWrapper(sniperbot_db, sniperbot_tg_db);
            break;

        case "pnl":
            sellWrapper(sniperbot_db, sniperbot_tg_db);
            break;     

        case "sell-main":
            

            //await pre_and_post_sell_operations_v2_emergency(2000, "4g4X48qFc8Muv61c9HZHVJhVUKtXTiqLBxhg9wgUGTpF", "", "");
            
            break;    
            
        case "sell":
           
            if (args.length >= 3) {
                const tokenAddress = args[1];
                const amountToken = parseFloat(args[2]);

                const secretKey = process.env.SECRET_KEY ? JSON.parse(process.env.SECRET_KEY) : null;
                const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

                await sell_token(amountToken, tokenAddress, "2088746736");
            } else {
                console.log("Error: Insufficient arguments for 'sell'");
            }
            break;
            
        case "buy":

            
            if (args.length >= 3) {

                const tokenAddress = args[1];
                const amount_usd = parseFloat(args[2]);
                await pre_and_post_buy_operations_v2_emergency(amount_usd, tokenAddress, "", sniperbot_db);
            
                break;    

            }
        case "sell-all":

        if (args.length >= 3) {
            const percentage_to_sell = args[1];
            
            await full_liquidation(parseFloat(percentage_to_sell), sniperbot_tg_db);
        } else {
            console.log("Error: Insufficient arguments for 'sell'");
        }
        break;
        
        case "balance":
            await printTokenBalancesInUSD();
            break;    
        
        default:
            console.log("BUY-BOT: Invalid command. Please provide one of the following inputs: \n\n-> buy\n-> buy-from-filtered\n-> sol-amount\n-> sell\n-> sell-all");
            process.exit(1);
    }
}
async function sell_manual(amountToken: number, token_address: String, db: Db) {
    return pre_and_post_sell_operations_v2(amountToken, token_address.toString(), "", "manual sell", db)
    
}

async function buy_manual(amount_usd: number, token_address: String) {

    console.log("Initializing the manual buy...");
    await pre_and_post_buy_operations_for_buy_manual(amount_usd, token_address.toString());
    
}


async function buy_for_active_wallets(amount_usd: number, token_address: string, db: Db) {
    console.log("Initializing the manual buy...");

    const activeWallets = await findActiveWallets(db);
    

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
            const total_balances = await get_wallet_balances_in_usd(wallet);
            

            const totalUSDInvested = typeof total_balances.totalUSDInvested === 'string' ? parseFloat(total_balances.totalUSDInvested) : total_balances.totalUSDInvested;
            console.log("Total USD Invested:", totalUSDInvested);

            const amount_usd_to_invest = total_balances.USDC_value * walletRecord.account_percent_to_invest;


            if (total_balances.sol_balance < 0.015 && totalUSDInvested > 3) {
                await pre_and_post_buy_operations_for_ACTIVATED_wallets(3, "So11111111111111111111111111111111111111112", wallet, walletRecord.telegramId);
                
            }else if (total_balances.sol_balance < 0.015 && totalUSDInvested < 3) {
                console.log("Not enough Balance to invest");
                return;
            }

            if (totalUSDInvested < 2) {
                console.log("Not enough Balance to invest");
                return;
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





main().catch(error => {
    console.error("Failed to run main function:", error);
    process.exit(1);
});