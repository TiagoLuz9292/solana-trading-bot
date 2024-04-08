import { processTransactions } from './my_wallet';
export { repeatProcessTransactions, removePendingTransactions };
import fs from 'fs';
import csvParse from 'csv-parse';
import { stringify } from 'csv-stringify';
import { parse } from 'csv-parse';

const x = 8 * 1000; // Time in milliseconds

async function repeatProcessTransactions() {
    try {
        await processTransactions();
        console.log('Transaction processing complete. Waiting for 8 seconds...');
    } catch (error) {
        console.error('Error processing transactions:', error);
    } finally {
        // Call repeatProcessTransactions again after 5 seconds
        setTimeout(repeatProcessTransactions, x);
               
    }
}

async function removePendingTransactions() {


    const filePath = '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/transactions_v2.csv'
    // Read the CSV file
    const fileContent = await fs.promises.readFile(filePath, { encoding: 'utf8' });

    // Parse the CSV content
    parse(fileContent, { columns: true }, (err, records: Array<{ [key: string]: string }>) => {
        if (err) {
            console.error('Error parsing CSV:', err);
            return;
        }

        // Filter out records where tx_state is not 'Pending'
        const filteredRecords = records.filter(record => record.tx_state !== 'Pending');

        // Convert the filtered records back to CSV
        stringify(filteredRecords, { header: true }, (err, output) => {
            if (err) {
                console.error('Error generating CSV:', err);
                return;
            }

            // Write the filtered data back to the file
            fs.promises.writeFile(filePath, output)
                .then(() => console.log('Pending transactions removed successfully.'))
                .catch(error => console.error('Error writing CSV:', error));
        });
    });
}

// Initiate the first call to the function
