import { parse, stringify } from 'csv';
import { readFileSync, writeFileSync } from 'fs';
declare module 'csv' {
    export function parse(input: string, options: any, callback: (err: any, output: any) => void): void;
    export function stringify(records: any[], options: any): string;
    // Add other methods you need from the csv package
  }

  interface SourceRecord {
    buy_date: string;
    sell_date: string;
    address: string;
    symbol: string;
    entryPrice: string;
    message: string;
    token_amount_sold: string; // Add new fields as needed
    usd_spent: string;
    usd_received: string;
    result_usd: string;
    
}




// The path to your CSV file
const csvFilePath = '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/sell_tracker_v2.csv';
const correctedCsvFilePath = '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/data/sell_tracker_v2 - Cópia.csv';

// Read the existing CSV file
const csvData = readFileSync(csvFilePath, 'utf8');

// Parse the CSV data
parse(csvData, { columns: true }, (err, records) => {
    if (err) {
        throw err;
    }

    // Map the existing records to the corrected format
    const correctedRecords = records.map((record: SourceRecord) => {
        // Assuming the values for 'token_amount_sold' are missing,
        // we need to shift every value after 'message' one position to the right
        return {
            ...record,
            token_amount_sold: '', // Set the new column value
            // Shift all other values one position to the right
            usd_spent: record.token_amount_sold,
            usd_received: record.usd_spent,
            result_usd: record.usd_received,
            // Add other fields as necessary
        };
    });

    // Stringify the corrected records back to CSV
    const correctedCsvData = stringify(correctedRecords, { header: true });

    // Write the corrected CSV data to a new file
    writeFileSync(correctedCsvFilePath, correctedCsvData);
});