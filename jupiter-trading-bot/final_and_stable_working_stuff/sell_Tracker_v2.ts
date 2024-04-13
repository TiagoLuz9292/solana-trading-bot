import { writeFile } from 'fs';

function createCSVWithHeaders(filePath: string, headers: string[]): void {
    // Join the headers array into a single string separated by commas
    const headerString = headers.join(',');

    // Use writeFile to create a new file with just the header string
    writeFile(filePath, headerString, (err) => {
        if (err) {
            console.error('Error writing to CSV file:', err);
        } else {
            console.log('CSV file created successfully with headers.');
        }
    });
}

// Define the path to the CSV file and the headers
const filePath = '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/sell_tracker_v2.csv';
const headers = [
    'buy_date', 'sell_date', 'address', 'symbol', 'entryPrice', 'exitPrice',
    'usd_spent', 'usd_received', 'result_usd'
];

// Call the function with the file path and headers
createCSVWithHeaders(filePath, headers);