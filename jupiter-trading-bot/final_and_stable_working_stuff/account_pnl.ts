import fs from 'fs';
import { Parser } from 'json2csv';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { format } from 'date-fns';
export {get_token_price, wrapper, get_token_prices, update_account_PNL};
import { swap_from_sol_to_token, swap_from_token_to_sol, pre_and_post_sell_operations} from '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/jupiter_swap_STABLE_VERSION'
import { getAllBalances, getTokenBalance, refresh_SOL_and_USDC_balance, processTransactions} from '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/my_wallet'

interface RecordType {
    address: string;
    tx_state: string;
    entryPrice?: string;
    TP?: string | null;
    currentPrice?: number;
    PNL?: number;
}

interface Record {
    tx_date: string;
    address: string;
    entryPrice?: string;
    currentPrice?: string;
    token_amount_received?: string;
    TP_price?: number;
    amount_to_sell?: number;
    PNL?: string;
}

interface TokenRecord {
    tx_date: string;
    address: string;
    entryPrice: string; // Adjust the type based on your actual data structure
    token_amount_received: string; // Adjust the type based on your actual data structure
    TP_price: string;
    amount_to_sell: string;
    PNL: string;
}

const TP_1_PRECENTAGE = 2.5;

async function get_token_price(tokenAddress: String): Promise<number> {
    const url = `https://public-api.dextools.io/trial/v2/token/solana/${tokenAddress}/price`;
    const headers = { "X-API-KEY": "t2UZtgUjAH07OL282qRu7hwNvJAmYik4uWY1E4w0" };
    
    try {
        await delay(2000)
        const response = await axios.get(url, { headers });
        const tokenPrice = response.data.data.price; // Access the 'price' property in the 'data' object
        //console.log("just got new price from API: " + tokenPrice);
        return tokenPrice;
    } catch (error) {
        console.error("Error fetching token price", error);
        throw error;
    }
}

async function get_token_prices(tokenAddresses: string[]): Promise<Map<string, number>> {
    const joinedAddresses = tokenAddresses.join('%2C');
    const url = `https://public-api.birdeye.so/public/multi_price?list_address=${joinedAddresses}`;
    const headers = { "X-API-KEY": "eccc7565cb0c42ff85c19b64a640d41f" };

    try {
        await delay(2000);
        const response = await axios.get(url, { headers });
        const prices = response.data.data;

        console.log("just got new prices from API");

        const priceMap = new Map<string, number>();
        for (const address of tokenAddresses) {
            const price = prices[address]?.value;
            if (price !== undefined) {
                priceMap.set(address, price);
            }
        }

        return priceMap;
    } catch (error) {
        console.error("Error fetching token prices", error);
        throw error;
    }
}



async function update_account_PNL_v2() {
    const transactionFilePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/transactions_v2.csv";
    const accountPnlFilePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/account_PNL_v2.csv";

    const csvContent = fs.readFileSync(transactionFilePath, { encoding: 'utf-8' });
    const records: RecordType[] = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
    }) as RecordType[];

    const tokenAddresses = records.map(record => record.address);
    const priceMap = await get_token_prices(tokenAddresses);
    

    const updatedRecords: RecordType[] = [];
    for (const record of records) {
        const currentPrice = priceMap.get(record.address);
        let pnl: number | undefined = undefined;

        if (record.tx_state === 'Completed' && record.entryPrice && currentPrice !== undefined) {
            pnl = ((currentPrice - parseFloat(record.entryPrice)) / parseFloat(record.entryPrice)) * 100;
        }

        const existingTP = record.TP && record.TP !== '' ? record.TP : null;
        updatedRecords.push({ ...record, currentPrice, PNL: pnl, TP: existingTP });
    }

    // Sort the updated records by PNL in descending order
    updatedRecords.sort((a, b) => (b.PNL ?? 0) - (a.PNL ?? 0));

    const json2csvParser = new Parser({ header: true });
    const csv = json2csvParser.parse(updatedRecords);
    fs.writeFileSync(accountPnlFilePath, csv);

    console.log(`Updated transactions saved to ${accountPnlFilePath}`);
    return updatedRecords;
}

async function update_account_PNL() {
    const logFilePath = '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/data_logs.csv';
    const startTimestamp = format(new Date(), 'dd-MM-yyyy HH:mm:ss');
    const startLog = `"${startTimestamp}","update_account_PNL() starting now."\n`;
    fs.appendFileSync(logFilePath, startLog);

    const src_csv_file = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_tracker_final.csv";
    const dest_csv_file = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/open_trades.csv";
    let all_transactions_succeed = true;

    try {
        const srcData = fs.readFileSync(src_csv_file, { encoding: 'utf-8' });
        const srcRecords: TokenRecord[] = parse(srcData, {
            columns: true,
            skip_empty_lines: true
        });

        let destRecords: TokenRecord[] = fs.existsSync(dest_csv_file)
            ? parse(fs.readFileSync(dest_csv_file, { encoding: 'utf-8' }), {
                columns: true,
                skip_empty_lines: true
            })
            : [];

        const destRecordsMap = destRecords.reduce((acc: {[key: string]: TokenRecord}, record: TokenRecord) => {
            const key = record.tx_date + record.address;
            acc[key] = record;
            return acc;
        }, {});

        // Get all balances at once
        const allBalances = await getAllBalances();

        for (const srcRecord of srcRecords) {
            const recordKey = srcRecord.tx_date + srcRecord.address;
            const currentPrice = await get_token_price(srcRecord.address);
            const entryPrice = parseFloat(srcRecord.entryPrice);
            const pnl = ((currentPrice - entryPrice) / entryPrice) * 100;

            if (destRecordsMap[recordKey]) {
                // Update PNL for existing record
                destRecordsMap[recordKey].PNL = pnl.toFixed(2);

                // Check token balance and update TP_price if necessary
                const tokenBalance = allBalances[destRecordsMap[recordKey].address];
                if (tokenBalance && tokenBalance < parseFloat(destRecordsMap[recordKey].amount_to_sell)) {
                    destRecordsMap[recordKey].TP_price = '';
                }

                // Check if TP_price is met and sell
                if (destRecordsMap[recordKey].TP_price && currentPrice >= parseFloat(destRecordsMap[recordKey].TP_price)) {
                    console.log(`\n***** Token at TP 1 price, SELLING ${destRecordsMap[recordKey].amount_to_sell} of ${destRecordsMap[recordKey].address} *****\n`);
                    const amountToSell = parseFloat(destRecordsMap[recordKey].amount_to_sell);
                    if (!isNaN(amountToSell)) {
                        const result = await pre_and_post_sell_operations(amountToSell, destRecordsMap[recordKey].address);
                        if (!result) {
                            all_transactions_succeed = false;
                        }
                    } else {
                        console.error("Invalid amount to sell for token:", destRecordsMap[recordKey].address);
                        all_transactions_succeed = false;
                    }
                }
            } else {
                // Handle new records
                const tokenAmountReceived = parseFloat(srcRecord.token_amount_received);
                const newRecord = {
                    ...srcRecord,
                    TP_price: (entryPrice * TP_1_PRECENTAGE).toFixed(9),
                    amount_to_sell: (tokenAmountReceived * 0.7).toFixed(2),
                    PNL: pnl.toFixed(2)
                };
                destRecords.push(newRecord);
                destRecordsMap[recordKey] = newRecord;
            }
        }

        destRecords = Object.values(destRecordsMap);
        destRecords.sort((a, b) => parseFloat(b.PNL) - parseFloat(a.PNL));

        const json2csvParser = new Parser({
            header: true,
            includeEmptyRows: false,
            fields: ['tx_date', 'address', 'entryPrice', 'token_amount_received', 'TP_price', 'amount_to_sell', 'PNL']
        });

        const csv = json2csvParser.parse(destRecords);
        fs.writeFileSync(dest_csv_file, csv, { encoding: 'utf-8' });

        console.log("\nAccount PNL updated and saved to destination CSV file.");
        return all_transactions_succeed;
    } catch (error) {
        console.error("An error occurred while updating account PNL:", error);
        return false;
    }
}


function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function wrapper() {
    async function callUpdate() {
        try {
            await update_account_PNL();
        } catch (error) {
            console.error("Error calling update_account_PNL:", error);
        } finally {
            setTimeout(callUpdate, 60 * 1000); // Call again after 8 seconds
        }
    }

    
    callUpdate();
}

