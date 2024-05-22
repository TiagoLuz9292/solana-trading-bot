/*
getTokenBalance(tokenAddress: String)
getAllBalances()

*/
import dotenv from "dotenv";
import WebSocket from 'ws';
import csv from 'csv-parser';
import {get_token_prices, get_token_price} from '/root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/transaction_manager';
import { writeFile, access } from 'fs/promises';
import { promises as fs } from 'fs';
import { parse } from 'csv-parse/sync';
import { Parser } from 'json2csv';
export { getAllBalances, getTokenBalance, get_SOL_balance as refresh_SOL_and_USDC_balance, processTransactions, get_SOL_balance as refresh_SOL_balance, printTokenBalancesInUSD};
import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL, TokenAccountsFilter } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { time } from 'console';
import { send_USDC, pay_taxes, pre_and_post_sell_operations_for_ACTIVE_wallets, pre_and_post_sell_operations_v2_emergency } from './jupiter_swap_STABLE_VERSION';
import { connectToDatabase, findWalletByTelegramId, getAllOpenOrders, getDatabase } from "./mongoDB_connection";
import axios from "axios";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";


dotenv.config({ path: '/root/project/solana-trading-bot/jupiter-trading-bot/.env' });



// Ensure the encryption key is properly configured
const encryptionKey = process.env.ENCRYPTION_KEY!;
if (!encryptionKey || Buffer.from(encryptionKey).length !== 32) {
    console.error("Encryption key is not set correctly in the environment. It must be 32 bytes.");
    process.exit(1); // Exit if the encryption key is not set correctly
}

const encryptText = (text: string) => {
    const iv = randomBytes(16); // Initialization vector for AES
    if (!text) {
        console.error("Attempted to encrypt undefined text.");
        return null; // Return null or handle this case as needed
    }
    try {
        const cipher = createCipheriv('aes-256-cbc', Buffer.from(encryptionKey), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted; // Returning the IV and encrypted data
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(`Encryption failed: ${error.message}`);
        } else {
            console.error(`An unexpected error occurred during encryption: ${error}`);
        }
        return null;
    }
};

const decryptText = (text: string) => {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
};





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



async function get_SOL_balance(): Promise<number> {
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
    const sol_balance = await get_SOL_balance();
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


export async function getAllBalances_v2(wallet: Keypair, retryCount = 3): Promise<{ [address: string]: number | undefined }> {
    
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



export async function get_wallet_balances_in_usd(wallet: Keypair) {

    //console.log(wallet);

    const balances = (await getAllBalances_v2(wallet) || {}) as { [address: string]: number };


    // Get unique token addresses from the balances
    const tokenAddresses = Object.keys(balances).filter(address => balances[address] > 0);
    const sol_balance = await get_SOL_balance_v2(wallet);

    if (tokenAddresses.length === 0 && sol_balance === 0) {
        console.log("No token balances to display.");
        return {
            sol_balance: 0,
            sol_value_in_USD: 0,
            USDC_value: 0,
            USDT_value: 0,
            tokens_USD_value: 0,
            totalUSDInvested: 0
        };
    }

    // Get prices for all tokens
    const priceMap = await get_token_prices(tokenAddresses);

    let tokenValues: { tokenAddress: string; usdValue: number; balance: number; }[] = [];
    let tokens_USD_value = 0; // To accumulate the total USD value
    let USDC_value = 0;
    let USDT_value = 0;
    for (const tokenAddress of tokenAddresses) {
        if (tokenAddress == "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") {
            USDC_value = balances[tokenAddress];
            continue;
        }
        if (tokenAddress == "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB") {
            USDT_value = balances[tokenAddress];
            continue;
        }
        const balance = balances[tokenAddress];
        const price = priceMap.get(tokenAddress);
        if (balance > 0 && price !== undefined) {
            const usdValue = balance * price;
            tokens_USD_value += usdValue; // Add to total USD invested
            tokenValues.push({ tokenAddress, usdValue, balance });
        }
    }

    // Sort the tokens by their USD value in descending order
    tokenValues.sort((a, b) => b.usdValue - a.usdValue);

    // Print the tokens in order
    tokenValues.forEach(({ tokenAddress, usdValue, balance }) => {
        console.log(`Address: ${tokenAddress}: USD Value: ${usdValue.toFixed(2)}    Balance: ${balance}`);
    });
    
    const sol_value_in_USD = await getAmountInUSD(sol_balance);
    const totalUSDInvested = (tokens_USD_value + USDC_value + sol_value_in_USD).toFixed(2);
    

    return {
        sol_balance,
        sol_value_in_USD,
        USDC_value,
        USDT_value,
        tokens_USD_value,
        totalUSDInvested
    };

}

async function get_SOL_balance_v2(wallet: Keypair): Promise<number> {
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


export async function convert_USDT_to_USDC(usdt_amount: number, wallet: Keypair) {


    const signature = await pre_and_post_sell_operations_for_ACTIVE_wallets(usdt_amount, "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", wallet, "");
    return signature;

}

export async function convert_SOL_to_USDC(usdt_amount: number, wallet: Keypair) {


    const signature = await pre_and_post_sell_operations_for_ACTIVE_wallets(usdt_amount, "So11111111111111111111111111111111111111112", wallet, "");
    return signature;
}


export async function withdraw_USDC(usdc_amount: number, destinationAddress: string, wallet: Keypair, currency: string): Promise<string> {
    
    console.log("Inside withdraw_USDC() in mywallet");

    const usdt_mint = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

    const usdc_mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

    const sol_mint = "So11111111111111111111111111111111111111112";

    let token_mint = "";
    

    if (currency === "SOL" || currency === "sol") {
        token_mint = sol_mint;
    }
    if (currency === "USDC" || currency === "usdc") {
        token_mint = usdc_mint;
    }

    const signature = await send_USDC(usdc_amount, destinationAddress, wallet, token_mint);

    return signature;
}

export async function pay_all_taxes(usdc_amount: number, wallet: Keypair): Promise<string> {
    console.log("calling pay_taxes of jupiter_swap script");
    const signature = await pay_taxes(usdc_amount, wallet);
    return signature;
}


export async function get_wallet_balances_in_usd_v2(wallet: Keypair) {
    const balances = (await getAllBalances_v2(wallet) || {}) as { [address: string]: number };
  
    // Get unique token addresses from the balances
    const tokenAddresses = Object.keys(balances).filter(address => balances[address] > 0);
    const sol_balance = await get_SOL_balance_v2(wallet);
  
    if (tokenAddresses.length === 0 && sol_balance === 0) {
      console.log("No token balances to display.");
      return {
        sol_balance: 0,
        sol_value_in_USD: 0,
        USDC_value: 0,
        USDT_value: 0,
        tokens_USD_value: 0,
        totalUSDInvested: 0,
        tokenDetails: ""
      };
    }
  
    // Include SOL address in tokenAddresses
    const SOL_ADDRESS = "So11111111111111111111111111111111111111112";
    if (sol_balance > 0) {
      tokenAddresses.push(SOL_ADDRESS);
    }
  
    // Get prices for all tokens
    const priceMap = await get_token_prices_jupiter(tokenAddresses);
  
    let tokenValues: { tokenAddress: string; usdValue: number; balance: number; }[] = [];
    let tokens_USD_value = 0; // To accumulate the total USD value
    let USDC_value = 0;
    let USDT_value = 0;
    let tokenDetailsArray: string[] = [];
    let sol_value_in_USD = 0;
  
    for (const tokenAddress of tokenAddresses) {
      if (tokenAddress == "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") {
        USDC_value = balances[tokenAddress];
        continue;
      }
      if (tokenAddress == "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB") {
        USDT_value = balances[tokenAddress];
        continue;
      }
      
      const balance = tokenAddress === SOL_ADDRESS ? sol_balance : balances[tokenAddress];
      const price = priceMap.get(tokenAddress);

      console.log(price);

      if (balance > 1 && price !== undefined) {
        const usdValue = balance * price;
        if (tokenAddress === SOL_ADDRESS) {
          sol_value_in_USD = usdValue;
        } else {
          tokens_USD_value += usdValue; // Add to total USD invested
        }
        tokenValues.push({ tokenAddress, usdValue, balance });
        tokenDetailsArray.push(`${tokenAddress}\nUSD Value: $${usdValue.toFixed(2)}\nBalance: ${balance.toFixed(2)}\n`);
      }
    }
  
    // Sort the tokens by their USD value in descending order
    tokenValues.sort((a, b) => b.usdValue - a.usdValue);
  
    // Concatenate the token details into a single string
    const tokenDetails = tokenDetailsArray.join('\n');
  
    // Print the tokens in order
    //tokenDetailsArray.forEach(detail => console.log(detail));
  
    const totalUSDInvested = (tokens_USD_value + USDC_value + sol_value_in_USD).toFixed(2);
  
    return {
      sol_balance,
      sol_value_in_USD,
      USDC_value,
      USDT_value,
      tokens_USD_value,
      totalUSDInvested,
      tokenDetails // Return the concatenated string
    };
  }

export async function get_token_prices_jupiter(tokenAddresses: string[]): Promise<Map<string, number>> {
    const JUPITER_PRICE_API_URL = 'https://price.jup.ag/v6/price';
    const MAX_TOKENS_PER_REQUEST = 100;
  
    const prices = new Map<string, number>();
  
    // Helper function to fetch prices for a chunk of token addresses
    async function fetchPrices(ids: string): Promise<void> {
      try {
        const response = await axios.get(JUPITER_PRICE_API_URL, {
          params: { ids }
        });
    
        for (const tokenId in response.data.data) {
          prices.set(tokenId, response.data.data[tokenId].price);
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error('Error fetching token prices:', error.response?.data || error.message);
        } else {
          console.error('Unexpected error:', error);
        }
        throw new Error('Failed to fetch token prices');
      }
    }
  
    // Split the token addresses into chunks of 100 and fetch prices for each chunk
    for (let i = 0; i < tokenAddresses.length; i += MAX_TOKENS_PER_REQUEST) {
      const chunk = tokenAddresses.slice(i, i + MAX_TOKENS_PER_REQUEST);
      const ids = chunk.join(',');
      await fetchPrices(ids);
    }
  
    return prices;
  }

export async function sell_token(token_amount: number, token_address: string, telegramId: string) {
    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");
    
    const existingWallet = await findWalletByTelegramId(telegramId, db);

    if (existingWallet) {
        const decryptedSecretKey = decryptText(existingWallet.secretKey);
        try {
            const secretKeyArray = JSON.parse(decryptedSecretKey); // Parse JSON string to array
            const wallet = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));

            console.log(`Swaping for wallet ${wallet}`);

            const signature = await pre_and_post_sell_operations_v2_emergency(token_amount, token_address, "manual sell", wallet, telegramId);
            
            
        } catch (parseError) {
            console.error('Error parsing decrypted secret key:', parseError);
            
        }
    }

    
}