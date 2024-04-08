import axios from 'axios';
import { swap_from_sol_to_token, swap_from_token_to_sol, pre_and_post_buy_operations, pre_and_post_sell_operations} from '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/jupiter_swap_STABLE_VERSION'
import { getAllBalances, getTokenBalance, refresh_SOL_and_USDC_balance, processTransactions} from '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/my_wallet'
import { removePendingTransactions, repeatProcessTransactions } from '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/trade_manager';
import { amountToUiAmount } from '@solana/spl-token';
import csv from 'csv-parser';
import fs, { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { Parser } from 'json2csv';
import {update_account_PNL, wrapper} from '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/account_pnl';
import {checkOHLCVConditions} from '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/check_OHLCV';
import {get_token_price, get_token_prices} from '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/account_pnl';
import { format } from 'date-fns';

import { stringify } from 'csv-stringify/sync';
import { log } from 'console';

interface TokenValue {
    tokenAddress: string;
    usdValue: number;
}

interface CsvRow {
    address: string;
    pairAddress: string;
}

interface Record {
    address: String;
    token_amount: number;
    PNL: number;
    TP?: number; // Optional TP property
}


const AMOUNT_USD_TO_BUY = 2;

function sleep(ms: number): Promise<void> {
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
    const url = "https://public-api.birdeye.so/public/price?address=So11111111111111111111111111111111111111112";
    const headers = { "X-API-KEY": "eccc7565cb0c42ff85c19b64a640d41f" };
    
    try {
        const response = await axios.get(url, { headers });
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

async function buy(amount_usd: number, token_address: String) {
    const amount_sol_string = await getAmountInSOL(amount_usd);
    const amount_sol = parseFloat(amount_sol_string);
    return pre_and_post_buy_operations(amount_usd, amount_sol, token_address);
    
}

async function buy_all_from_filtered() {

    let all_transactions_succeed = true;
    const logFilePath = '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/data_logs.csv';
    const filePath = '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/level_2_filter.csv';
    const balances = await getAllBalances();
    // Append start log to the CSV
    const startTimestamp = format(new Date(), 'dd-MM-yyyy HH:mm:ss');
    const startLog = `"${startTimestamp}","buy_all_from_filtered() starting now."\n`;
    fs.appendFileSync(logFilePath, startLog);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
        console.log("The source csv file level_2_filter.csv is empty.\n");
        return;
    }

    const data: CsvRow[] = []; // Use an array to collect data from the stream
    const stream = fs.createReadStream(filePath).pipe(csv());

    // Collect data from the stream into an array
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

                    all_transactions_succeed = await buy(AMOUNT_USD_TO_BUY, row.address);
                    await sleep(1000); // Ensure a pause before processing the next token

                } catch (error) {
                    console.error('Error during buy operation:', error);
                }
            }
        } else {
            console.log("INFO: Wallet already holds that token, not Buying.");
            await sleep(1000); // If you need to delay even when not buying, you should await the sleep
        }
    }
    if (all_transactions_succeed) {
        console.log('All transactions processed.');
        return true;
    }
    console.log('Some transactions failed.');
    return false;
    
}



async function sell_all_for_address(token_balance: number, tokenAddress: String) {
    //const token_balance = await getTokenBalance(tokenAddress);

    //if (token_balance === undefined) {
    //    console.error('Token balance is undefined.');
     //   return; // Handle the undefined case appropriately
    //}
    
    await pre_and_post_sell_operations(token_balance, tokenAddress);
}

const args = process.argv.slice(2);

if (args.length < 1) {
    console.log("Usage: ts-node script_name.ts case_number [optional_arguments]");
    process.exit(1);
}
function transactionsTP(xValue: String, yValue: number) {
    const csvFile = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/transactions.csv";
    const data = readFileSync(csvFile, { encoding: 'utf8' });

    let records = parse(data, {
        columns: true,
        skip_empty_lines: true
    });

    records = records.map((record: any) => {
        if (record.X === xValue) {
            record.TP = yValue;
        }
        return record;
    });

    const updatedCsv = stringify(records, { header: true });
    writeFileSync(csvFile, updatedCsv);
}


async function checkAndSell_v2() {
    const src_csv_file = '/path/to/source.csv'; // Replace with your source file path
    const dest_csv_file = '/path/to/destination.csv'; // Replace with your destination file path (if needed)

    try {
        const data = fs.readFileSync(src_csv_file, { encoding: 'utf-8' });
        const records = parse(data, {
            columns: true,
            skip_empty_lines: true
        });

        for (const record of records) {
            const tokenAddress = record.address;
            const amountToSell = parseFloat(record.amount_to_sell);
            const tpPrice = parseFloat(record.TP_price);

            const currentPrice = await get_token_price(tokenAddress);

            if (currentPrice > tpPrice) {
                console.log(`Current price ${currentPrice} is higher than TP price ${tpPrice}. Initiating sell for ${tokenAddress}`);
                await pre_and_post_sell_operations(amountToSell, tokenAddress);
            } else {
                console.log(`Current price ${currentPrice} is not higher than TP price ${tpPrice} for ${tokenAddress}. No action taken.`);
            }
        }

        console.log("Check and sell process completed.");
    } catch (error) {
        console.error("An error occurred during the check and sell process:", error);
    }
}

async function checkAndSell() {
    console.log("starting checkandsell");
    const filePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/account_PNL_v2.csv";
    const csvContent = fs.readFileSync(filePath, { encoding: 'utf-8' });
    const records: Record[] = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
    });

    let addressToChangeTP: String = "";
    let newTP = 0;
    
    for (const record of records) {
        console.log("TP " + record.TP);
        if (!record.TP) {
            console.log("ENTERED TP IF");
            
            console.log("PNL " + record.PNL + " for address: " + record.address);
            if (record.PNL > 250) {
                console.log("ENTERED PNL IF");
        
                const tokenBalance = await getTokenBalance(record.address);
                if(tokenBalance !== undefined && tokenBalance > 0) {
                    const amountToSell = 0.75 * tokenBalance;
                    console.log("token amount on wallet: " + tokenBalance)
                    console.log("amount to sell: " + amountToSell);
                    await pre_and_post_sell_operations(amountToSell, record.address);
                    record.TP = 1;
                    addressToChangeTP = record.address;
                    newTP = 1;
                }
                
            }
        }
        if (record.TP == 1 && record.PNL > 9850) {
            const tokenBalance = await getTokenBalance(record.address);
            if(tokenBalance !== undefined && tokenBalance > 0) {
                const amountToSell = 0.80 * tokenBalance;
                console.log("token amount on wallet: " + tokenBalance)
                console.log("amount to sell: " + amountToSell);
                await pre_and_post_sell_operations(amountToSell, record.address);
                record.TP = 2;
                addressToChangeTP = record.address;
                newTP = 2;
            }
        }
    }

    await delay(5000)
    console.log("BLABLABLA");
    // Convert the updated records back to CSV format
    const json2csvParser = new Parser({ header: true });
    const csv = json2csvParser.parse(records);

    // Write the CSV content back to the same file
    fs.writeFileSync(filePath, csv);

}

async function checkAndBuy() {
   
    //await buy_all_from_filtered();

    console.log("DEBUG: Exiting buy_all_from_filtered()");

    for (let i = 0; i < 4; i++) {
        if (i < 4) { // Add delay between calls, except after the last one
            console.log("Waiting 8 seconds before the next iteration...");
            await delay(8000); // Wait for 8 seconds
        }
        console.log(`DEBUG: Entering processTransactions() - Iteration ${i + 1}`);
        await processTransactions();
        console.log(`DEBUG: Exiting processTransactions() - Iteration ${i + 1}`);

        
    }

    console.log("DEBUG: Entering removePendingTransactions()");
    await removePendingTransactions();
    console.log("DEBUG: Exiting removePendingTransactions()");
}

async function checkAndBuyDEGENERATE() {
    console.log("DEBUG: Entering buy_all_from_filtered()");
    await buy_all_from_DEGEN_lIST();
    console.log("DEBUG: Exiting buy_all_from_filtered()");

    
        
    await processTransactions() 
    console.log("Waiting 15 seconds...");
    await delay(7000); // Wait for 8 seconds
        
}

async function buy_all_from_DEGEN_lIST() {
    const filePath = '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/dexTools_DEGENERATE_token_list.csv';
    const AMOUNT_USD_TO_BUY_DEGENERATE = 0.1;
    // First, get all balances
    const balances = await getAllBalances();

    // Wrap the CSV processing in a Promise to ensure we wait for all operations to complete
    await new Promise<void>((resolve, reject) => {
        const results: Array<{ address: string }> = [];

        console.log("Checking for new DEGENERATE Buy opportunities =D")
        fs.createReadStream(filePath)
            .pipe(csv({ columns: true } as any))
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                for (const row of results) {
                    const balance = balances[row.address];
                    if (balance === undefined || balance === 0) {
                        try {
                            // Perform the buy operation
                            const transaction = await buy(AMOUNT_USD_TO_BUY_DEGENERATE, row.address);
                            
                            // Wait for 10 seconds before processing the next row
                            await sleep(3000);
                        } catch (error) {
                            console.error('Error during buy operation:', error);
                            // Optionally delay even if there's an error to ensure spacing of retry or next operation
                            await sleep(3000);
                            // You might want to decide whether to reject or continue processing here
                        }
                    } else {
                        // Still wait if no buy operation is needed to maintain consistent pacing
                        console.log("This token was already bought. Not buying more.")
                        await sleep(3000);
                    }
                }
                console.log('All transactions processed.');
                resolve(); // Resolve the promise after all rows are processed
            })
            .on('error', (error) => {
                console.error('Error reading CSV file:', error);
                reject(error); // Reject the promise on stream error
            });
    });
}

async function startAutoBuyProcess(mode: String) {

    if (mode == "degen") {
        while (true) {
            try {
                await checkAndBuyDEGENERATE();
                // Wait for 5 minutes before repeating the process
                console.log("Waiting 5 minutes before starting the next cycle...");
                await delay(5000); // 5 minutes in milliseconds
            } catch (error) {
                console.error("An error occurred during the auto-buy process:", error);
                // Decide if you want to continue or exit the loop in case of an error
                // For now, we'll just wait 5 minutes before trying again
                await delay(5000);
            }
        }
    }
    else{
        while (true) {
            try {
                await checkAndBuy();
    
                // Wait for 5 minutes before repeating the process
                console.log("Waiting 5 minutes before starting the next cycle...");
                await delay(5000); // 5 minutes in milliseconds
            } catch (error) {
                console.error("An error occurred during the auto-buy process:", error);
                // Decide if you want to continue or exit the loop in case of an error
                // For now, we'll just wait 5 minutes before trying again
                await delay(5000);
            }
        }
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

    for (const tokenAddress of tokenAddresses) {
        const balance = balances[tokenAddress];
        const price = priceMap.get(tokenAddress);
        if (balance > 0 && price !== undefined) {
            const usdValue = balance * price;
            tokenValues.push({ tokenAddress, usdValue, balance });
        }
    }

    // Sort the tokens by their USD value in descending order
    tokenValues.sort((a, b) => b.usdValue - a.usdValue);

    // Print the tokens in order
    tokenValues.forEach(({ tokenAddress, usdValue, balance }) => {
        console.log(`Address: ${tokenAddress}: USD Value: ${usdValue.toFixed(2)}`);
        console.log(`Balance: ${balance}`)
    });

    // Example of selling logic, uncomment if you need to execute sells
    // for (const { tokenAddress, balance } of tokenValues) {
    //     if (usdValue < 0.45) {
    //         await sell_all_for_address(balance, tokenAddress);
    //         await delay(6000);
    //     }
    // }
}

async function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function full_liquidation() {
    console.log("Starting full liquidation process...");
    
    const balances = await getAllBalances();
    
    for (const [tokenAddress, balance] of Object.entries(balances)) {
      if (balance && balance > 0 && balance < 0.1) {
        console.log(`Liquidating ${balance} tokens of address ${tokenAddress}...`);
        await sell_all_for_address(balance, tokenAddress);
      }
    }
  
    console.log("Liquidation process completed.");
  }

  function buyWrapper() {
    async function buyTokens() {
        try {
            const result = await buy_all_from_filtered();
            // Set the timeout only if the result is explicitly false
            if (result === true) {
                setTimeout(buyTokens, 180 * 1000); // Call again after 5 minutes
            }else {
                setTimeout(buyTokens, 1 * 1000);
            }
        } catch (error) {
            console.error("Error calling buy_all_from_filtered:", error);
            // Don't retry automatically in case of error
        }
    }

    buyTokens();
}

function sellWrapper() {
    async function sellTokens() {
        try {
            const result = await update_account_PNL();
            await printTokenBalancesInUSD();
            // Set the timeout only if the result is explicitly false
            if (result === true) {
                console.log("all_transactions_succeed" + (result))
                console.log("all_transactions_succeed should be TRUE")
                setTimeout(sellTokens, 45 * 1000); // Call again after 5 minutes
            }else {
                console.log("all_transactions_succeed" + (result))
                console.log("all_transactions_succeed should be FALSE")
                setTimeout(sellTokens, 1 * 1000);
            }
        } catch (error) {
            console.error("Error calling update_account_PNL:", error);
        }
    }
    
    sellTokens();
}


// Access the command-line argument
const arg1 = args[0];

// Switch case to call specific functions based on the argument value
switch (arg1) {
    case "buy":
        if (args.length >= 3) {
            const token_address = args[1]
            const amount_usd = args[2]

            buy(parseFloat(amount_usd), token_address);
        } else {
            console.log("Error: Insufficient arguments for 'buy'");
        }
        break;
    case "buy-from-filtered":
        buyWrapper();
        break;



    case "pnl":
        sellWrapper();
        break;     





    case "auto-sell":
        setInterval(() => {
            checkAndSell();
        }, 10 * 1000);         // 10 sec
        break;   



    case "sol-amount":
        if (args.length >= 2) {
            const amountUsdt = parseFloat(args[1]);
            const amountSol = getAmountInSOL(amountUsdt);
            console.log(`USD amount: ${amountUsdt}`);
            console.log(`SOL amount: ${amountSol}`);
        } else {
            console.log("Error: Insufficient arguments for 'sol-amount'");
        }
        break;
    case "sell":
        if (args.length >= 3) {
            const tokenAddress = args[1];
            const amountToken = parseFloat(args[2]);
            pre_and_post_sell_operations(amountToken, tokenAddress);
        } else {
            console.log("Error: Insufficient arguments for 'sell'");
        }
        break;
    case "sell-all":
        if (args.length >= 2) {
            const tokenAddress = args[1];
            //sell_all_for_address(tokenAddress);
        } else {
            console.log("Error: Insufficient arguments for 'sell-all'");
        }
        break;
    case "full-liquidation":
        full_liquidation(); 
        break;    
    case "balance":
        getAllBalances();
        break;
 
    case "auto-buy":
        startAutoBuyProcess("fff");
        break;
    case "balance-in-usd":
        printTokenBalancesInUSD();
        break;    
    case "remove-pending":
        removePendingTransactions();
        break;    
    
    case "degen":
        checkAndBuyDEGENERATE();
        break;
    default:
        console.log("BUY-BOT: Invalid command. Please provide one of the following inputs: \n\n-> buy\n-> buy-from-filtered\n-> sol-amount\n-> sell\n-> sell-all");
        process.exit(1);
}