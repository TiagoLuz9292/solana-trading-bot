import fs from 'fs';
import csv from 'csv-parser';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';

// Specify your CSV file path
const inputFilePath = '/root/project/solana-trading-bot/data/open_orders_v2.csv';
const outputFilePath = '/root/project/solana-trading-bot/data/open_orders_v2.csv';

interface CsvRecord {
    entryPrice: string;
    TP_price_1?: string;
    TP_price_2?: string;
    TP_price_3?: string;
    [key: string]: any;  // To include other columns without explicit typing
}

async function processCsvFile() {
    const records: CsvRecord[] = [];

    // Read the CSV file
    fs.createReadStream(inputFilePath)
        .pipe(csv())
        .on('data', (data: CsvRecord) => {
            const entryPrice = parseFloat(data.entryPrice);
            data.TP_price_1 = (entryPrice * 1.70).toFixed(9);
            data.TP_price_2 = (entryPrice * 2.45).toFixed(9);
            data.TP_price_3 = (entryPrice * 4.65).toFixed(9);
            records.push(data);
        })
        .on('end', () => {
            console.log('CSV file successfully processed');
            writeUpdatedCsv(records);
        });
}

function writeUpdatedCsv(records: CsvRecord[]) {
    const csvWriter = createCsvWriter({
        path: outputFilePath,
        header: Object.keys(records[0]).map(key => ({id: key, title: key}))
    });

    csvWriter.writeRecords(records)
        .then(() => console.log('The CSV file was written successfully'));
}

processCsvFile();