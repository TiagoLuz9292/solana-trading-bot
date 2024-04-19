/*
getTokenBalance(tokenAddress: String)
getAllBalances()

*/
import dotenv from "dotenv";
import csv from 'csv-parser';
import {get_token_price, get_token_prices} from '/root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/account_pnl';
import { writeFile, access } from 'fs/promises';
import { promises as fs } from 'fs';
import { parse } from 'csv-parse/sync';
import { Parser } from 'json2csv';
export { getAllBalances, getTokenBalance, refresh_SOL_balance as refresh_SOL_and_USDC_balance, processTransactions, refresh_SOL_balance, printTokenBalancesInUSD};
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
dotenv.config({ path: '/root/project/solana-trading-bot/jupiter-trading-bot/.env' });

// Initialize the Solana connection
const web3 = require('@solana/web3.js');
const solanaConnection = new web3.Connection('https://serene-soft-dream.solana-mainnet.quiknode.pro/d9545d21916469751695fb7a165e97325634fdb5', 'confirmed');
    'confirmed'

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

async function refresh_SOL_balance(): Promise<number> {
    if (!wallet) {
        console.error('Wallet not initialized');
        return 0; // return 0 if the wallet is not initialized
    }

    try {
        const results = await Promise.allSettled([
            solanaConnection.getBalance(wallet.publicKey),
        ]);

        const solBalanceResult = results[0];
        if (solBalanceResult.status === 'fulfilled') {
            const solBalance = solBalanceResult.value / LAMPORTS_PER_SOL; // Convert lamports to SOL
            
            return solBalance; // return SOL balance
        } else if (solBalanceResult.status === 'rejected') {
            console.error('Error fetching SOL balance:', solBalanceResult.reason);
        }
    } catch (error) {
        console.error('Unexpected error during balance refresh:', error);
    }

    return 0; // return 0 if the balance couldn't be fetched or on error
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


  async function printTokenBalancesInUSD() {
    const balances = (await getAllBalances() || {}) as { [address: string]: number };

    // Get unique token addresses from the balances
    const tokenAddresses = Object.keys(balances).filter(address => balances[address] > 0);

    if (tokenAddresses.length === 0) {
        console.log("No token balances to display.");
        return;
    }

    // Get prices for all tokens
    const priceMap = await get_token_prices(tokenAddresses);

    let tokenValues: { tokenAddress: string; usdValue: number; balance: number; }[] = [];
    let totalUSDInvested = 0; // To accumulate the total USD value
    let USDC_value = 0;
    for (const tokenAddress of tokenAddresses) {
        if (tokenAddress == "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") {
            USDC_value = balances[tokenAddress];
            continue;
        }
        const balance = balances[tokenAddress];
        const price = priceMap.get(tokenAddress);
        if (balance > 0 && price !== undefined) {
            const usdValue = balance * price;
            totalUSDInvested += usdValue; // Add to total USD invested
            tokenValues.push({ tokenAddress, usdValue, balance });
        }
    }

    // Sort the tokens by their USD value in descending order
    tokenValues.sort((a, b) => b.usdValue - a.usdValue);

    // Print the tokens in order
    tokenValues.forEach(({ tokenAddress, usdValue, balance }) => {
        console.log(`Address: ${tokenAddress}: USD Value: ${usdValue.toFixed(2)}    Balance: ${balance}`);
    });
    const sol_balance = await refresh_SOL_balance();
    const sol_value_in_USD = await getAmountInUSD(sol_balance);
    console.log(`Sol balance: ${sol_balance}`);
    console.log(`Sol total in USD: ${sol_value_in_USD}`);
    console.log(`Tokens total in USD: ${totalUSDInvested}`);
    console.log(`Total USDC: $${USDC_value.toFixed(2)}`);
    totalUSDInvested += sol_value_in_USD;
    // Print the total amount of USD invested in the wallet
    
    console.log(`Total USD Invested: ${(totalUSDInvested + USDC_value).toFixed(2)}`);
    const telegram_message = `Sol balance: ${sol_balance}\nSol USD value: $${sol_value_in_USD.toFixed(2)}\nTotal USDC: $${USDC_value.toFixed(2)}\nTokens USD value: $${(totalUSDInvested - sol_value_in_USD).toFixed(2)}\n\n Total USD value: 🟢 $${(totalUSDInvested + USDC_value).toFixed(2)} 🟢`
    return telegram_message;
    
}

async function getAmountInUSD(solAmount: number): Promise<number> {
    //const url = "https://public-api.birdeye.so/public/price?address=So11111111111111111111111111111111111111112";
    //const headers = { "X-API-KEY": "eccc7565cb0c42ff85c19b64a640d41f" };
    
    try {
        //const response = await axios.get(url, { headers });
        //await delay(1000);
        //const solPrice = response.data.data.value;
        const solPrice = await get_token_price("So11111111111111111111111111111111111111112");
        console.log(`SOL Price: ${solPrice}`);

        // Calculate the amount in USD for the given amount of SOL
        const usdAmount = solAmount * solPrice;
        return usdAmount;
    } catch (error) {
        console.error("Error fetching SOL price", error);
        throw error;
    }
}



async function getAllBalances(retryCount = 3): Promise<{ [address: string]: number | undefined }> {
    if (!wallet) {
        console.error('Wallet not initialized');
        throw new Error('Wallet not initialized');
    }

    let attempts = 0;
    while (attempts < retryCount) {
        try {
            await delay(1000); // delay to prevent hammering the server if there's a quick retry
            const tokenAccounts = await solanaConnection.getParsedTokenAccountsByOwner(wallet.publicKey, { programId: TOKEN_PROGRAM_ID });
            const balances: { [address: string]: number | undefined } = {};
            
            for (const { account } of tokenAccounts.value) {
                const tokenAddress = account.data.parsed.info.mint.toString();
                const balance = account.data.parsed.info.tokenAmount.uiAmount;
                if (balance && balance > 0) {
                    balances[tokenAddress] = balance;
                }
            }
            return balances; // successful fetch, return balances
        } catch (error) {
            console.error(`Attempt ${attempts + 1} failed: Error fetching all token balances`, error);
            attempts++;
            if (attempts >= retryCount) {
                throw new Error(`Failed to fetch balances after ${retryCount} attempts`); // throws if all retries fail
            }
        }
    }

    // This line should theoretically never be reached because the last throw inside the catch block should either succeed or throw an error.
    throw new Error('Unreachable code executed in getAllBalances function');
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
