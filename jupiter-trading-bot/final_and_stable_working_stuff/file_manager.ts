import { Parser } from "json2csv";
import { promises as fs } from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { readFileSync, writeFileSync } from 'fs';





async function removeLastColumnValueOfLastLineOfTRANSACTIONS() {
    const filePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/transactions_v2.csv";
    
    try {
        // Define the address and value to search for
        const searchAddress = '5QMLt3gtWumqjouEnP3ud1KRTR87mAoxv42tBcECxmk';
        const searchValue = '"2024-04-02T14:35:50.757Z';
        const columnToCheck = 'second_TP_amount_token_sold';

        // Read the file content
        const content = await fs.readFile(filePath, { encoding: 'utf-8' });
        
        // Parse the CSV content
        const records = parse(content, { columns: true, skip_empty_lines: true });

        // Find and update the record if it matches the criteria
        const updatedRecords = records.map((record: any) => {
            if (record.address === searchAddress && (record[columnToCheck] === null || record[columnToCheck] === 'none' || record[columnToCheck] === '')) {
                record[columnToCheck] = ''; // Remove the value
            }
            return record;
        });

        // Convert the updated records back to CSV
        const updatedContent = stringify(updatedRecords, { header: true });

        // Write the updated content back to the file
        await fs.writeFile(filePath, updatedContent, { encoding: 'utf-8' });
        console.log('Value removed successfully if it matched the criteria.');
    } catch (error) {
        console.error('Error processing the CSV file:', error);
    }
}

async function create_transactions_file() {
    const filePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/transactions.csv";
    
    // Define the header fields
    const fields = ['address', 'usd_spent', 'sol_spent', 'tx_state', 'entryPrice', 'token_amount_received', 'TP', 'first_TP_profit_in_usd', 'second_TP_profit_in_usd', 'first_TP_amount_token_sold', 'second_TP_amount_token_sold'];
    const json2csvParser = new Parser({ fields });
    
    // Parse the headers to CSV format and ensure it ends with a newline
    const csv = json2csvParser.parse([]) + '\n';

    try {
        // Check if the file exists
        try {
            await fs.access(filePath);
            console.log(`File already exists: ${filePath}`);
        } catch (accessError) {
            // File does not exist, write the file with a newline at the end
            await fs.writeFile(filePath, csv, { encoding: 'utf-8' });
            console.log(`Headers saved to csv file: ${filePath}`);
        }
    } catch (error) {
        console.error(`Error accessing or writing to csv file: ${error}`);
    }
}

async function create_transactions_file_V2() {
    const filePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/transactions_v2.csv";
    
    // Define the header fields
    const fields = ['tx_date', 'address', 'usd_spent', 'sol_spent', 'tx_state', 'entryPrice', 'token_amount_received', 'TP', 'first_TP_profit_in_usd', 'second_TP_profit_in_usd', 'first_TP_amount_token_sold', 'second_TP_amount_token_sold'];
    const json2csvParser = new Parser({ fields });
    
    // Parse the headers to CSV format and ensure it ends with a newline
    const csv = json2csvParser.parse([]) + '\n';

    try {
        // Check if the file exists
        try {
            await fs.access(filePath);
            console.log(`File already exists: ${filePath}`);
        } catch (accessError) {
            // File does not exist, write the file with a newline at the end
            await fs.writeFile(filePath, csv, { encoding: 'utf-8' });
            console.log(`Headers saved to csv file: ${filePath}`);
        }
    } catch (error) {
        console.error(`Error accessing or writing to csv file: ${error}`);
    }
}

async function create_sell_tracker_file() {
    const filePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/sell_tracker.csv";
    
    // Define the header fields
    const fields = ['date_time', 'address', 'token_amount_sold'];
    const json2csvParser = new Parser({ fields, header: true });
    
    // Parse the headers to CSV format
    const csv = json2csvParser.parse([]); // The empty array ensures only headers are written

    try {
        await fs.writeFile(filePath, csv, { flag: 'wx' });
        console.log(`File created and headers saved to: ${filePath}`);
    } catch (error) {
        // Cast error to any to access the code property
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
            console.log(`File already exists: ${filePath}`);
        } else {
            // Log the error as an unknown type since it's not guaranteed to be an ErrnoException
            console.error(`Error creating csv file:`, error);
        }
    }
}

async function create_sell_tracker_file_v2() {
    const filePath = "/root/project/solana-trading-bot/data/sell_tracker_v2.csv";
    
    // Define the header fields
    const fields = ['date_time', 'address', 'token_amount_sold', 'sol_received', 'profit_in_usd'];
    const opts = { fields, header: true, eol: '\n' }; // Ensure end-of-line character is set
    const parser = new Parser(opts);
    
    // Parse the headers to CSV format and include a newline
    const csv = parser.parse([]) + opts.eol; // The empty array ensures only headers are written with a newline at the end

    try {
        await fs.writeFile(filePath, csv, { flag: 'wx' }); // 'wx' - Write, failing if the path exists
        console.log(`File created and headers saved to: ${filePath}`);
    } catch (error: unknown) {
        // First, we make sure that this is an object and has a 'code' property.
        if (typeof error === 'object' && error !== null && 'code' in error) {
            // Now TypeScript knows that 'error' is an object with a 'code' property
            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError.code === 'EEXIST') {
                console.log(`File already exists: ${filePath}`);
            } else {
                console.error(`Error creating csv file:`, nodeError);
            }
        } else {
            // If the error doesn't have a 'code' property, it might not be a NodeJS.ErrnoException
            console.error('An unexpected error occurred:', error);
        }
    }
}

interface Record {
    address: string;
    // ... other properties, including second_TP_amount_token_sold if it's always present
    second_TP_amount_token_sold?: string;
    [key: string]: string | undefined; // This allows indexing with a string to accommodate additional fields
  }
  
  async function removeValueFromSpecificRecord(filePath: string, addressToClear: string, columnToClear: string) {
    try {
      const content = readFileSync(filePath, { encoding: 'utf-8' });
      const records: Record[] = parse(content, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true, // This allows records with a different number of columns
      });
  
      const updatedRecords = records.map((record: Record) => {
        if (record.address === addressToClear) {
          record[columnToClear] = ''; // Clear the specified column
        }
        return record;
      });
  
      const updatedContent = stringify(updatedRecords, { header: true });
      writeFileSync(filePath, updatedContent);
      console.log('Column value cleared successfully for the specified address.');
    } catch (error) {
      console.error('Error processing the CSV file:', error);
    }
  }



interface RecordType {
  tx_date: string;
  address: string;
  usd_spent: string;
  sol_spent: string;
  tx_state: string;
  entryPrice: string | null | undefined;
  token_amount_received: string;
}

async function removeEmptyEntryPriceRows(filePath: string): Promise<void> {
  try {
    const data = await fs.readFile(filePath, { encoding: 'utf-8' });
    const records: RecordType[] = parse(data, { columns: true });

    const filteredRecords = records.filter(record => record.entryPrice && record.entryPrice.trim() !== '');

    if (filteredRecords.length === records.length) {
      console.log("No rows with empty entryPrice found.");
    } else {
      console.log(`Removed ${records.length - filteredRecords.length} rows with empty entryPrice.`);
      const csv = stringify(filteredRecords, { header: true });
      await fs.writeFile(filePath, csv, { encoding: 'utf-8' });
      console.log("CSV file has been updated and empty entryPrice rows removed.");
    }
  } catch (error) {
    console.error("An error occurred while processing the CSV file:", error);
  }
}

//removeEmptyEntryPriceRows("/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_tracker_final.csv");
/*
  const filePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/transactions_v2.csv";
  removeValueFromSpecificRecord(filePath, 'EJcPRUTv3cpcavNpzzVcPbziTQX4pEKGSgRazq1fSUCs', 'second_TP_amount_token_sold');
*/
  

