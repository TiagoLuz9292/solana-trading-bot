import fs, { appendFileSync, existsSync, readFileSync } from 'fs';
import { Parser } from 'json2csv';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { format } from 'date-fns';
export {get_token_price, update_account_PNL_v3, update_pnl_after_buy_v2, update_sell_tracker_after_sell};
import { swap_from_sol_to_token, swap_from_token_to_sol, pre_and_post_sell_operations} from '/root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/jupiter_swap_STABLE_VERSION'
import { getAllBalances, getTokenBalance, refresh_SOL_and_USDC_balance, processTransactions} from '/root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/my_wallet'
import { off } from 'process';
import { promises as fsPromises } from 'fs'; 
import { appendFile, writeFile, stat } from 'fs/promises';
import { stringify } from 'csv-stringify/sync';
import { log } from 'console';
import {send_message} from './telegram_bot';








interface TransactionData {
    tx_date: string;
    address: String;
    symbol: String;
    usd_spent: number;
    sol_spent: number;
    entryPrice: number;
    token_amount_received: number;
}

interface TokenToSell {
    date_time: string;
    address: String;
    symbol: String;
    token_amount_sold: number;
    profit_in_usd: number;
    message: String;
}

interface TokenRecord {
    tx_date: string;
    address: string;
    symbol: string;
    entryPrice: string; // Adjust the type based on your actual data structure
    token_amount_received: string; // Adjust the type based on your actual data structure
    TP_price_1: string;
    TP_price_2: string;
    TP_price_3: string;
    amount_to_sell: string;
    PNL: string;
    USD_value: string;
}

interface record_from_open_trades {
    tx_date: string;
    address: string;
    symbol: string;
    usd_spent: string;
    entryPrice: string;
    token_amount_received: string;
}

interface DestinationRecord {
    buy_date: string;
    sell_date: string;
    address: String;
    symbol: String;
    entryPrice: string;
    exitPrice: string;
    message: String;
    token_amount_sold: string;
    usd_spent: number;
    usd_received: string;
    result_usd: string;
}

interface TokenToSell {
    date_time: string;
    address: String;
    symbol: String;
    token_amount_sold: number;
    profit_in_usd: number;
}

interface SourceRecord {
    tx_date: string;
    address: string;
    symbol: string;
    usd_spent: string;
    entryPrice: string;
    token_amount_received: string;
}

const STOP_LOSS = -25;
const BREAKEVEN = 20;

const TP_1_PRICE = 1.70;
const TP_2_PRICE = 2.45;
const TP_3_PRICE = 4.65;

const TP_1_AMOUNT = 0.65;
const TP_2_AMOUNT = 0.65;
const TP_3_AMOUNT = 0.65;

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function get_token_price(tokenAddress: String): Promise<number> {
    const url = `https://public-api.dextools.io/trial/v2/token/solana/${tokenAddress}/price`;
    const headers = { "X-API-KEY": "t2UZtgUjAH07OL282qRu7hwNvJAmYik4uWY1E4w0" };
    
    try {
        await delay(2000)
        const response = await axios.get(url, { headers });
        //const tokenPrice = response.data.data.price; // Access the 'price' property in the 'data' object
        const tokenPrice = response.data?.data?.price;
        if (tokenPrice !== undefined) {
            // Proceed with using tokenPrice
        } else {
            throw new Error("Token price not available in API response");
        }
        //console.log("just got new price from API: " + tokenPrice);
        return tokenPrice;
    } catch (error) {
        console.error("Error fetching token price", error);
        throw error;
    }
}

async function get_token_prices(tokenAddresses: string[]): Promise<Map<string, number>> {
    const MAX_ADDRESSES_PER_CALL = 30;
    const priceMap = new Map<string, number>();

    for (let i = 0; i < tokenAddresses.length; i += MAX_ADDRESSES_PER_CALL) {
        const chunk = tokenAddresses.slice(i, i + MAX_ADDRESSES_PER_CALL);
        const joinedAddresses = chunk.join('%2C');
        const url = `https://public-api.birdeye.so/defi/multi_price?list_address=${joinedAddresses}`;
        const headers = { "X-API-KEY": "cf15975d7aaf402fbac45058e252960e" };

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


async function update_sell_tracker_after_sell(data: TokenToSell[]) {
    const src_csv_path = '/root/project/solana-trading-bot/data/open_orders_v2.csv';
    const dest_csv_path = '/root/project/solana-trading-bot/data/sell_tracker_v2.csv';

    const fileContent = readFileSync(src_csv_path, { encoding: 'utf-8' });
    const records: SourceRecord[] = parse(fileContent, {
        columns: true,
        skip_empty_lines: true
    });

    let symbol: String;
    let message: String = "";
    let token_amount = "";
    let usdc_result = 0;
    let token_address: String;
    const newRecords: DestinationRecord[] = data.map(sellData => {
        const sourceRecord = records.find(record => record.address === sellData.address);
        if (!sourceRecord) {
            throw new Error(`No matching record found for address: ${sellData.address}`);
        }

        
        const exitPrice = sellData.profit_in_usd / parseFloat(sellData.token_amount_sold.toFixed(2));
        const percentChangeFromEntry = ((exitPrice - parseFloat(sourceRecord.entryPrice)) / parseFloat(sourceRecord.entryPrice)) * 100;
        


        const usdReceived = sellData.profit_in_usd;
        const usdSpent = parseFloat(sourceRecord.usd_spent);
        
        
        if (message && typeof message === "string" && message.includes("% SL reached!!")) {
            usdc_result = usdReceived - usdSpent;
        } else {
            usdc_result = usdReceived - ((sellData.token_amount_sold * usdSpent) / parseFloat(sourceRecord.token_amount_received));
        }

        symbol = sellData.symbol;
        message = sellData.message;
        token_amount = sellData.token_amount_sold.toFixed(2);
        token_address = sellData.address;
        
        send_message(`🟢‼️✅ NEW SELL 🚨🟢🔥\n\n${message}\n\nSold:   ${token_amount} ${symbol}\nUSDC received:   $${(usdc_result).toFixed(2)} USDC\n\nToken address:\n${token_address}\n\nDexTools link:\nhttps://www.dextools.io/app/pt/solana/pair-explorer/${token_address}?t=1713211991329\n\nSell link:\nhttps://jup.ag/swap/${token_address}-USDC\n\n@Furymuse`);

        return {
            buy_date: sourceRecord.tx_date,
            sell_date: sellData.date_time,
            address: sellData.address,
            symbol: sellData.symbol,
            entryPrice: sourceRecord.entryPrice,
            exitPrice: exitPrice.toFixed(9),
            message: message,
            token_amount_sold: sellData.token_amount_sold.toFixed(2),
            usd_spent: usdSpent,
            usd_received: usdReceived.toString(),
            result_usd: usdc_result.toFixed(2)
    
        };
    });

    // Check if the destination file exists and write accordingly
    if (!existsSync(dest_csv_path)) {
        // Create the file with headers
        const csvHeaders = ['buy_date', 'sell_date', 'address', 'symbol', 'entryPrice', 'exitPrice', 'message', 'token_amount_sold', 'usd_spent', 'usd_received', 'result_usd',];
        const csvData = stringify(newRecords, {
            header: true,
            columns: csvHeaders
        });
        await fsPromises.writeFile(dest_csv_path, csvData, { encoding: 'utf-8' });
    } else {
        // Append the new records without headers
        const csvData = stringify(newRecords, {
            header: false,
            columns: ['buy_date', 'sell_date', 'address', 'symbol', 'entryPrice', 'exitPrice', 'message', 'token_amount_sold', 'usd_spent', 'usd_received', 'result_usd']
        });
        await fsPromises.appendFile(dest_csv_path, csvData, { encoding: 'utf-8' });
    }
    
    console.log('Sell tracker updated successfully.');
}


async function update_pnl_after_buy_v2(data: TransactionData[]) {
    const csvFilePath = '/root/project/solana-trading-bot/data/open_orders_v2_inbound.csv';
  
    // Generate the CSV data with two decimal places for monetary values
    const csvData = data.map(d => ({
        tx_date: d.tx_date,
        address: d.address,
        symbol: d.symbol,
        usd_spent: d.usd_spent.toFixed(2),
        sol_spent: d.sol_spent.toFixed(2),
        entryPrice: d.entryPrice.toFixed(9),
        token_amount_received: d.token_amount_received.toFixed(2),
        TP_price_1: (d.entryPrice * TP_1_PRICE).toFixed(9),
        TP_price_2: (d.entryPrice * TP_2_PRICE).toFixed(9),
        TP_price_3: (d.entryPrice * TP_3_PRICE).toFixed(9),
        PNL: '', // Placeholder for PNL
        USD_value: '' // Placeholder for USD value
      }));
  
    try {
      // Attempt to read the file to determine if it exists
      await fsPromises.access(csvFilePath);
  
      // If the file exists, read its content to determine if we should append a newline
      const fileContent = await fsPromises.readFile(csvFilePath, 'utf-8');
      const shouldAppendNewline = fileContent.endsWith('\n') ? '' : '\n';
      const csv = stringify(csvData, { header: false });
  
      // Append the data to the file with the correct newline handling
      await fsPromises.appendFile(csvFilePath, shouldAppendNewline + csv, 'utf-8');
    } catch (error) {
      // If the file does not exist (error code ENOENT), create it with headers
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log("File does not exist, will create a new one with headers.");
        const headers = ['tx_date', 'address', 'symbol', 'usd_spent', 'sol_spent', 'entryPrice', 'token_amount_received', 'TP_price_1', 'TP_price_2', 'TP_price_3', 'PNL', 'USD_value'];
        const csv = stringify(csvData, { header: true, columns: headers });
  
        // Create the file with headers and the first data entry
        await fsPromises.writeFile(csvFilePath, csv, 'utf-8');
      } else {
        // Log and rethrow any other error
        console.error("An unexpected error occurred", error);
        throw error;
      }
    }
  
    console.log("Data successfully appended to the CSV file.");
  }

  

  async function updateDestinationFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
        const sourceData = await readCsv(sourcePath);
        let destinationData = await readCsv(destinationPath);
        const balances = await getAllBalances();

        // Filter out records that are already in the destination file and have a sufficient balance
        const newRecords = sourceData.filter(sourceRecord => {
            const balance = balances[sourceRecord.address] || 0;
            return balance > 1 && !destinationData.some(destRecord => destRecord.address === sourceRecord.address);
        });

        if (newRecords.length > 0) {
            // Sort destinationData by tx_date in descending order to get the most recent records first
            destinationData.sort((a, b) => {
                const dateA = new Date(a.tx_date).getTime();
                const dateB = new Date(b.tx_date).getTime();
                return dateB - dateA;
            });

            // Iterate through newRecords and add only the latest record for each address
            newRecords.forEach(newRecord => {
                const existingIndex = destinationData.findIndex(destRecord => destRecord.address === newRecord.address);
                if (existingIndex !== -1) {
                    const existingDate = new Date(destinationData[existingIndex].tx_date).getTime();
                    const newDate = new Date(newRecord.tx_date).getTime();
                    if (newDate > existingDate) {
                        destinationData[existingIndex] = newRecord;
                    }
                } else {
                    destinationData.push(newRecord);
                }
            });

            await writeCsv(destinationData, destinationPath);
            console.log(`${newRecords.length} new records appended.`);
        } else {
            console.log('No new records to append.');
        }
    } catch (error) {
        console.error('Error updating the destination file:', error);
    }
}

async function readCsv(filePath: string): Promise<any[]> {
    const fileExists = fs.existsSync(filePath);
    if (!fileExists) {
        // Create the file with headers if it does not exist
        const headers = 'tx_date,address,symbol,usd_spent,sol_spent,entryPrice,token_amount_received,TP_price_1,TP_price_2,TP_price_3,PNL,USD_value\n';
        await fsPromises.writeFile(filePath, headers);
        return [];
    }
    const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true
    });
    return records;
}

async function writeCsv(data: any[], filePath: string): Promise<void> {
    const json2csvParser = new Parser({
        fields: ['tx_date', 'address', 'symbol', 'usd_spent', 'sol_spent', 'entryPrice', 'token_amount_received', 'TP_price_1', 'TP_price_2', 'TP_price_3', 'PNL', 'USD_value'],
        header: true
    });
    const csv = json2csvParser.parse(data);
    await fsPromises.writeFile(filePath, csv);
}


async function update_account_PNL_v3() {
    const src_csv_file = "/root/project/solana-trading-bot/data/open_orders_v2_inbound.csv";
    const dest_csv_file = "/root/project/solana-trading-bot/data/open_orders_v2.csv";

    // First, update the destination file with new records from the source file
    await updateDestinationFile(src_csv_file, dest_csv_file);

    // Then read the updated destination CSV to process
    const destRecords = await readCsv(dest_csv_file);
    let all_transactions_succeed = true;

    try {
        const tokenAddresses = destRecords.map(record => record.address);
        const priceMap = await get_token_prices(tokenAddresses);
        const allBalances = await getAllBalances();

        const updatedRecords: TokenRecord[] = [];
        for (const record of destRecords) {
            const currentBalance = allBalances[record.address];
            const currentPrice = priceMap.get(record.address);
            const token_amount_received = parseFloat(record.token_amount_received);
            const entryPrice = parseFloat(record.entryPrice);

            

            // Check if balance exists and is greater than 0
            if (!currentBalance || currentBalance < 1) {
                console.log(`Skipping record for address ${record.address} due to zero or non-existent balance.`);
                continue; // Skip to the next record if the balance is zero or undefined
            }
            if(!currentPrice) {
                console.log(`It was not possible to get the price for ${record.address}.`);
                continue;
            }

            const pnl = ((currentPrice - entryPrice) / entryPrice) * 100;
            record.PNL = `${pnl.toFixed(2)} %`;
            
            const usdValue = ((currentBalance * currentPrice) * pnl) / 100;
            record.USD_value = usdValue.toFixed(2);
            
            
            if (currentBalance < ((record.token_amount_received * 0.35))) {
                record.TP_price_1 = '';
            }
           
            if (currentBalance < ((record.token_amount_received * 0.35) * 0.35)) {
                record.TP_price_2 = '';
            }

            if (currentBalance < (((record.token_amount_received * 0.35)) * 0.35) * 0.35) {
                record.TP_price_3 = '';
            }

            if (!record.TP_price_1 && pnl <= BREAKEVEN) {
                console.log(`\n***** Token at BREAKEVEN, SELLING ${currentBalance} of ${record.address} *****\n`);
                const result = await pre_and_post_sell_operations(currentBalance, record.address, record.symbol, "Breakeaven SL reached!!")
                if (!result) {
                    all_transactions_succeed = false;
                }else {
                    continue;
                }
            }    
            
            console.log(`\n***** current price of ${record.address} -> ${currentPrice} ; TP price : ${record.TP_1_PRICE} *****\n`);

            if (record.TP_price_1 && currentPrice >= parseFloat(record.TP_price_1)) {
                console.log(`\n***** Token at TP_price_1, SELLING ${currentBalance * TP_1_AMOUNT} of ${record.address} ***** PRICE= ${currentPrice}, TP_price= ${record.TP_price_1} \n`);
                const result = await pre_and_post_sell_operations((currentBalance * TP_1_AMOUNT), record.address, record.symbol, "TP 1 Reached!!")
                    if (!result) {
                        all_transactions_succeed = false;
                    }else {
                        record.TP_price_1 = ''; // Clear TP_price after selling
                    }
            }
            if (!record.TP_price_1 && record.TP_price_2 && currentPrice >= parseFloat(record.TP_price_2)) {
                console.log(`\n***** Token at TP_price_2, SELLING ${currentBalance * TP_2_AMOUNT} of ${record.address} *****\n`);
                const result = await pre_and_post_sell_operations((currentBalance * TP_2_AMOUNT), record.address, record.symbol, "TP 2 Reached!!")
                    if (!result) {
                        all_transactions_succeed = false;
                    }else {
                        record.TP_price_2 = ''; // Clear TP_price after selling
                    }
            }
            if (!record.TP_price_1 && !record.TP_price_2 && record.TP_price_3 && currentPrice >= parseFloat(record.TP_price_3)) {
                console.log(`\n***** Token at TP_price_3, SELLING ${currentBalance * TP_3_AMOUNT} of ${record.address} *****\n`);
                const result = await pre_and_post_sell_operations((currentBalance * TP_3_AMOUNT), record.address, record.symbol, "TP 3 Reached!!")
                    if (!result) {
                        all_transactions_succeed = false;
                    }else {
                        record.TP_price_3 = ''; // Clear TP_price after selling
                    }
            }

            
            
            if (pnl <= STOP_LOSS) {
                console.log(`\n***** PNL below ${STOP_LOSS}%, SELLING ENTIRE BALANCE of ${record.address} *****\n`);
                const result = await pre_and_post_sell_operations(currentBalance, record.address, record.symbol, `${STOP_LOSS}% SL reached!!`)
                if (!result) {
                    all_transactions_succeed = false;
                }else {
                    continue;
                }
            }else {
                
            }

            updatedRecords.push(record);
        }

        updatedRecords.sort((a, b) => {
            const pnlA = parseFloat(a.PNL);
            const pnlB = parseFloat(b.PNL);
            return pnlB - pnlA; // For descending order
        });

        const parser = new Parser({
            fields: ['tx_date', 'address', 'symbol', 'usd_spent', 'sol_spent', 'entryPrice', 'token_amount_received', 'TP_price_1', 'TP_price_2', 'TP_price_3', 'PNL', 'USD_value']
        });
        const csv = parser.parse(updatedRecords);
        await fsPromises.writeFile(dest_csv_file, csv, { encoding: 'utf-8' });

        console.log("Open trades updated successfully.");
        return all_transactions_succeed;
    } catch (error) {
        console.error("An error occurred while updating account PNL:", error);
        return false;
    }
}


