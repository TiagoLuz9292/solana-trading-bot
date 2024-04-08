/*
getTokenBalance(tokenAddress: String)
getAllBalances()

*/
import csv from 'csv-parser';

import { writeFile, access } from 'fs/promises';
import { promises as fs } from 'fs';
import { parse } from 'csv-parse/sync';
import { Parser } from 'json2csv';
export { getAllBalances, getTokenBalance, refresh_SOL_balance as refresh_SOL_and_USDC_balance, processTransactions};
import { config } from 'dotenv';
import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL, TokenAccountsFilter } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { time } from 'console';

interface CsvRecord {
    address: string;
    usd_spent: string; // Assuming this is the format in your CSV
    sol_spent: string;
    tx_state: string;
    entryPrice?: number; // Optional because it may not exist yet
    token_amount_received?: number; // Optional for the same reason
}

interface Balances {
    [address: string]: number | undefined;
}
interface RecordType {
    address: string;
    usd_spent: string; // Assuming usd_spent is stored as a string in CSV
    sol_spent: string; // Assuming sol_spent is stored as a string in CSV
    tx_state: string;
    // ... any other fields that are in your CSV
    token_amount_received?: number; // These fields might be added/updated
    entryPrice?: number;
}

interface Transaction {
    token_amount_received: number;
    address: string;
    usd_spent: number;
    tx_state: string;
    entryPrice?: number;
}

interface Balance {
    address: string;
    balance: number;
}

// Load environment variables from .env file
config();

// Initialize the Solana connection
const solanaConnection = new Connection("https://api.mainnet-beta.solana.com");

// Load the wallet's secret key
let wallet: Keypair | null = null;
if (process.env.SECRET_KEY) {
    const secretKey = JSON.parse(process.env.SECRET_KEY);
    wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
} else {
    console.error('No SECRET_KEY environment variable found.');
    process.exit(1); // Exit if there is no secret key
}

const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
let usdcBalance = 0;
let solBalance = 0;
let tokenBalance = 0;




async function getTokenBalance(tokenAddress: String): Promise<number | undefined> {
    //console.log("DEBUG: getting ballance for: " + tokenAddress);
    // Ensure the wallet is initialized (wallet should be a global or passed as a parameter)
    if (!wallet) {
        console.error('Wallet not initialized');
        return;
    }

    // Check if the token account exists
    const accountExists = await check_if_token_account_exists(tokenAddress);
    if (!accountExists) {
        return;
    }
    
    // Get the associated token address
    const tokenMint = new PublicKey(tokenAddress);
    const tokenAssociatedTokenAddress = await getAssociatedTokenAddress(tokenMint, wallet.publicKey);

    // Initialize connection to the Solana RPC
    const solanaConnection = new Connection("https://api.mainnet-beta.solana.com");

    // Implement exponential backoff for the retry mechanism
    const maxRetries = 5;
    let attempt = 0;
    let tokenBalance: number | undefined | null;
    
    while (attempt < maxRetries) {
        try {
            await delay(1000)
            const result = await solanaConnection.getTokenAccountBalance(tokenAssociatedTokenAddress);
            tokenBalance = result.value.uiAmount; // Or however you need to access the balance
            break; // If successful, break out of the loop
        } catch (error: any) { // 'any' type used for error to access error.code; you can define a more specific error type
            if (error.code === 429) { // Check for 'Too Many Requests' error code
                const delay = Math.pow(2, attempt) * 500; // Calculate exponential backoff delay
                console.error(`Server responded with 429 Too Many Requests. Retrying after ${delay}ms delay...`);
                await sleep(delay);
                attempt++;
            } else {
                // For any other errors, log and break the loop
                console.error('Unexpected error during balance refresh:', error);
                break;
            }
        }
    }

    if (tokenBalance === undefined) {
        console.error('Failed to get token balance after maximum retries.');
    }
    if (tokenBalance === null) {
        // Decide how to handle the null case
        // For example, you may choose to return undefined or handle it differently
        return undefined;
    }
    return tokenBalance;
}

async function check_if_token_account_exists(tokenAddress: String): Promise<boolean> {
    if (!wallet) {
        console.error('Wallet not initialized');
        return false; // Ensure function returns false if wallet is not initialized
    }

    try {
        const tokenAccounts = await solanaConnection.getParsedTokenAccountsByOwner(wallet.publicKey, { programId: TOKEN_PROGRAM_ID });
        for (const { account } of tokenAccounts.value) {
            const address = account.data.parsed.info.mint.toString();
            if (tokenAddress === address) 
                return true;
        }
        return false; // Return false if the token is not found
    } catch (error) {
        console.error('Error fetching all token balances:', error);
        return false; // Return false in case of an error
    }
}

async function refresh_SOL_balance(): Promise<void> {
    if (!wallet) {
        console.error('Wallet not initialized');
        return;
    }

    
    try {
        const results = await Promise.allSettled([
            solanaConnection.getBalance(wallet.publicKey),
        ]);

        const solBalanceResult = results[0];
      

        if (solBalanceResult.status === 'fulfilled') {
            solBalance = solBalanceResult.value / LAMPORTS_PER_SOL; // Convert lamports to SOL
        } else if (solBalanceResult.status === 'rejected') {
            console.error('Error fetching SOL balance:', solBalanceResult.reason);
        }

        console.log("Balance:")
        console.log(`----------`);
        console.log(`SOL: ${solBalance}`);

    } catch (error) {
        console.error('Unexpected error during balance refresh:', error);
    }
}


async function processTransactions(): Promise<void> {
    const CSV_FILE_PATH = '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/transactions_v2.csv';
    try {
      try {
        await fs.access(CSV_FILE_PATH);
      } catch {
        console.error(`No transactions file found at ${CSV_FILE_PATH}, skipping processing.`);
        return;
      }
  
      const csvContent = await fs.readFile(CSV_FILE_PATH, { encoding: 'utf-8' });
      const records: CsvRecord[] = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
      });
  
      const balances: Balances = await getAllBalances();
  
      const updatedRecords = records.map((record: CsvRecord) => {
        if (record.tx_state === 'Pending') {
          const addressBalance = balances[record.address];
          if (addressBalance && addressBalance > 0) {
            console.log(`Address ${record.address} has a balance higher than 0 and is in Pending state: ${addressBalance}`);
            record.tx_state = 'Completed';
            record.token_amount_received = addressBalance;
            record.entryPrice = Number(record.usd_spent) / addressBalance;
          }
        }
        return record;
      });
  
      const json2csvParser = new Parser({ fields: Object.keys(records[0]), header: true });
      const updatedCsv = json2csvParser.parse(updatedRecords);
  
      await fs.writeFile(CSV_FILE_PATH, updatedCsv, { encoding: 'utf-8' });
      console.log(`Updated transactions saved to ${CSV_FILE_PATH}`);
    } catch (error) {
      console.error("Error during processing transaction:", error);
    }
  }

  async function getAllBalances(): Promise<{ [address: string]: number | undefined }> {
    console.log("DEBUG: getting all balances");
    await refresh_SOL_balance();

    if (!wallet) {
        console.error('Wallet not initialized');
        return {};
    }
    
    const balances: { [address: string]: number | undefined } = {};

    try {
        await delay(1000);
        const tokenAccounts = await solanaConnection.getParsedTokenAccountsByOwner(wallet.publicKey, { programId: TOKEN_PROGRAM_ID });

        for (const { account } of tokenAccounts.value) {
            const tokenAddress = account.data.parsed.info.mint.toString();
            const balance = account.data.parsed.info.tokenAmount.uiAmount;
            if (balance && balance > 0) { // Only add token with balance greater than 0
                //console.log(`${tokenAddress}: ${balance}`);
                balances[tokenAddress] = balance; // Assign balance to the address key in the balances object
            }
        }

    } catch (error) {
        console.error('Error fetching all token balances:', error);
    }

    return balances; // Return the object containing address-balance pairs
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}
//processTransactions();
//setInterval(processTransactions, 20000);


// Refresh balances and then print them

/*
refreshBalances().then(() => {
    console.log('Balance')
    
    printAllBalances(); // Print all token balances after refreshing
});

*/

//getTokenBalance("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
