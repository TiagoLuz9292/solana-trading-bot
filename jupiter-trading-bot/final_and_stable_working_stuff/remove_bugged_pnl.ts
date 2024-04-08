import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

async function removeRecordByAddress(filePath: string, addressToRemove: string) {
    // Read the existing content of the CSV file
    const csvContent = fs.readFileSync(filePath, { encoding: 'utf-8' });

    // Parse the CSV content
    const records: RecordType[] = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
    });

    // Filter out the record with the specified address and usd_spent less than 5
    const updatedRecords = records.filter(record => {
        return !(record.address === addressToRemove && parseFloat(record.usd_spent) == 20);
    });

    // Convert the updated records back to CSV format
    const updatedCsvContent = stringify(updatedRecords, { header: true });

    // Write the updated CSV content back to the file
    fs.writeFileSync(filePath, updatedCsvContent, { encoding: 'utf-8' });

    console.log(`Record with address ${addressToRemove} and USD spent less than 5 has been removed from ${filePath}`);
}

// Define the RecordType interface if not already defined
interface RecordType {
    address: string;
    usd_spent: string;  // Assuming usd_spent is a string that needs to be converted to a number
    [key: string]: string;
}

// Usage
const filePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/transactions_v2.csv";
const addressToRemove = "EJcPRUTv3cpcavNpzzVcPbziTQX4pEKGSgRazq1fSUCs";
removeRecordByAddress(filePath, addressToRemove);