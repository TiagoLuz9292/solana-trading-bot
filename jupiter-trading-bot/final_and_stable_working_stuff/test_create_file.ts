import {create_transactions_file, create_sell_tracker_file, create_transactions_file_V2, create_sell_tracker_file_v2} from './file_manager';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';


interface Record {
    address: string;
    usd_spent: string;
    // include other properties as needed
}


async function copyCsvWithTimestamp() {
    const srcFilePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/account_PNL.csv"
    const destFilePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/account_PNL_v2.csv"
    const csvContent = fs.readFileSync(srcFilePath, { encoding: 'utf-8' });
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });

    const updatedRecords = records.map((record: any) => {
        const currentDateTime = new Date().toISOString();
        return { tx_date: currentDateTime, ...record };
    });

    const csv = stringify(updatedRecords, { header: true });
    fs.writeFileSync(destFilePath, csv);

    console.log(`CSV content copied from ${srcFilePath} to ${destFilePath} with added timestamp.`);
}

function removeRecord(filePath: string) {
    const csvContent = fs.readFileSync(filePath, { encoding: 'utf-8' });
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });

    const updatedRecords = records.filter((record: any) =>
    !(record.address === '4JY9tPfnJU9fUtEbhVEghbfbwDG5qwPKEYmYtyxA2vkP' && record.usd_spent === '0.15')
);

    const csv = stringify(updatedRecords, { header: true });
    fs.writeFileSync(filePath, csv);
}

const filePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/account_PNL_v2.csv";  // Set your CSV file path here
removeRecord(filePath);



