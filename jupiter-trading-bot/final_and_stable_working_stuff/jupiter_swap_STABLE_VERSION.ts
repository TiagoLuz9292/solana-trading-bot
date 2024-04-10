
/*
NOW IT SAVES TRANSACTIONS TO FILES, AND MY WALLET SCRIPT CHECKS IF IT WAS COMPLETED AND UPDATES IT

THIS IS THE MAIN ONE

*/
import { BigNumber } from 'bignumber.js';
import { promises as fs } from 'fs';
import { Parser } from 'json2csv';
import {get_token_price} from './account_pnl';
export { swap_from_sol_to_token, swap_from_token_to_sol, pre_and_post_buy_operations, pre_and_post_sell_operations};
import { getAllBalances, getTokenBalance } from './my_wallet';
import { create_sell_tracker_file, create_sell_tracker_file_v2, create_transactions_file, create_transactions_file_V2 } from './file_manager';
import { Keypair, Connection, ParsedConfirmedTransaction, TransactionSignature, TokenBalance, PublicKey, ParsedInstruction, Transaction, VersionedTransaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import dotenv from "dotenv";
import axios from "axios";
import { log } from 'console';
import path from 'path';
import fetch from 'node-fetch';




dotenv.config();

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
const solanaEndpoint = "https://api.mainnet-beta.solana.com";
const secretKey = process.env.SECRET_KEY ? JSON.parse(process.env.SECRET_KEY) : null;



const maxSlippage = 200;

const web3 = require('@solana/web3.js');

const connection = new web3.Connection('https://serene-soft-dream.solana-mainnet.quiknode.pro/d9545d21916469751695fb7a165e97325634fdb5', 'confirmed');
    'confirmed'


const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

console.log(`Wallet: ${wallet.publicKey.toBase58()}\n`)

//const connection = new Connection(solanaEndpoint, 'confirmed');

const solMint = new PublicKey("So11111111111111111111111111111111111111112");
const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

interface TokenTransfer {
    fromTokenAccount: string;
    toTokenAccount: string;
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
    tokenStandard: string;
}

interface NativeTransfer {
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
}

interface ApiResponse {
    nativeTransfers: NativeTransfer[];
    // Add other properties as needed
}

async function ensureAssociatedTokenAccount(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    sleep(5000);
    const associatedTokenAddress = await getAssociatedTokenAddress(mint, owner);
    //const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
    
    //if (!accountInfo) {
    console.log(`Creating associated token account for ${mint.toString()} owned by ${owner.toString()}`);
    const createAccountIx = createAssociatedTokenAccountInstruction(
        owner,
        associatedTokenAddress,
        owner,
        mint,
        wallet.publicKey,
        TOKEN_PROGRAM_ID
    );
    const transaction = new Transaction().add(createAccountIx);
    await connection.sendTransaction(transaction, [wallet], { skipPreflight: true, preflightCommitment: 'confirmed' });
    //}

    return associatedTokenAddress;
}

async function swap(quoteResponse: any, sourceMint: PublicKey, destinationMint: PublicKey) {
    
    const sourceTokenAccount = await ensureAssociatedTokenAccount(sourceMint, wallet.publicKey);
    console.log("SOL associated token account created!")
    const destinationTokenAccount = await ensureAssociatedTokenAccount(destinationMint, wallet.publicKey);
    console.log("Output token associated token account created!")

    if (quoteResponse && quoteResponse.routePlan && quoteResponse.routePlan.length > 0) {
        const payload = {
            userPublicKey: wallet.publicKey.toString(),
            wrapAndUnwrapSol: true,
            useSharedAccounts: true,
            //feeAccount: wallet.publicKey.toString(),
            prioritizationFeeLamports: 350000,
            asLegacyTransaction: false,
            useTokenLedger: false,
            destinationTokenAccount: destinationTokenAccount.toString(),
            dynamicComputeUnitLimit: true,
            skipUserAccountsRpcCalls: true,
            quoteResponse: quoteResponse
        };

        try {
            const response = await axios.post("https://quote-api.jup.ag/v6/swap", payload, { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } });
            
        
            //console.log(`DEBUG: Received swap response: ${JSON.stringify(response.data, null, 2)}`);
            
            return response.data;
        } catch (error) {
            console.error('Error during swap:', error);
            throw error;
        }
    } else {
        console.error("Invalid quote response or empty route plan");
    }
}

async function swap_v2(quoteResponse: any, sourceMint: PublicKey, destinationMint: PublicKey) {
    
    const sourceTokenAccount = await ensureAssociatedTokenAccount(sourceMint, wallet.publicKey);
    const destinationTokenAccount = await ensureAssociatedTokenAccount(destinationMint, wallet.publicKey);

    if (quoteResponse && quoteResponse.routePlan && quoteResponse.routePlan.length > 0) {
        const payload = {
            userPublicKey: wallet.publicKey.toString(),
            wrapAndUnwrapSol: true,
            useSharedAccounts: true,
            //feeAccount: wallet.publicKey.toString(),
            prioritizationFeeLamports: 125000,
            asLegacyTransaction: false,
            useTokenLedger: false,
            destinationTokenAccount: destinationTokenAccount.toString(),
            dynamicComputeUnitLimit: true,
            skipUserAccountsRpcCalls: true,
            quoteResponse: quoteResponse
        };

        try {
            const response = await axios.post("https://quote-api.jup.ag/v6/swap", payload, { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } });
            console.log("Swap response:", JSON.stringify(response.data, null, 2));
            return response.data;
        } catch (error) {
            console.error('Error during swap:', error);
            throw error;
        }
    } else {
        console.error("Invalid quote response or empty route plan");
    }
}


async function swap_from_sol_to_usdc() {
    const url = "https://quote-api.jup.ag/v6/quote";
    const params = {
        inputMint: solMint.toString(),
        outputMint: usdcMint.toString(),
        amount: '253652'
    };

    try {
        const quote = await axios.get(url, { params });
        const quoteResponse = quote.data;
        console.log("DEBUG: PRINTING QUOTE RESPONSE");
        console.log(JSON.stringify(quoteResponse, null, 2));

        const swapResponse = await swap(quoteResponse, solMint, usdcMint);
        if (!swapResponse || !swapResponse.swapTransaction) {
            console.error("Swap failed or swap transaction is missing");
            return;
        }

        const serializedTransaction = Buffer.from(swapResponse.swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(serializedTransaction);
        transaction.sign([wallet]);  // Sign the transaction with your wallet

        // Send the transaction
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: true,  // Assume Jupiter has already pre-checked the transaction
        });

        console.log("Swap successful with signature:", signature);
    } catch (error) {
        console.error("Error during main process:", error);
    }
}

async function swap_from_sol_to_token_v2(amount_sol : number, token_Address : String) {

    const amount_sol_to_buy = amount_sol * 1000000000;
    
    const tokenMint = new PublicKey(token_Address)

    const url = "https://quote-api.jup.ag/v6/quote";
    const params = {
        inputMint: solMint.toString(),
        outputMint: tokenMint.toString(),
        amount: amount_sol_to_buy.toString(),  // use the amount_usdc parameter for the amount
        slippage: maxSlippage.toString()
    };
    
    try {
        console.log("ASKIIIIIIIIIIIIINNNGG FOR QUOTEEEEEEEEEEEE");
        const quote = await axios.get(url, { params });
        const quoteResponse = quote.data;
        console.log("DEBUG: PRINTING QUOTE RESPONSE ON SWAP FROM SOL TO TOKEN");
        console.log(JSON.stringify(quoteResponse, null, 2));

        const swapResponse = await swap(quoteResponse, solMint, tokenMint); // Corrected the parameters here
        if (!swapResponse || !swapResponse.swapTransaction) {
            console.error("Swap failed or swap transaction is missing");
            return;
        }

        const serializedTransaction = Buffer.from(swapResponse.swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(serializedTransaction);
        transaction.sign([wallet]);  // Sign the transaction with your wallet

        // Send the transaction
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: true,  // Assume Jupiter has already pre-checked the transaction
        });

        console.log("Swap successful with signature:", signature);
        return signature;
    } catch (error) {
        console.error("Error during swap process:", error);
    }
}

async function swap_from_sol_to_token(amount_sol : number, token_Address : String) {
    //console.log("INFO: Initiating swap from SOL to token...");
    const amount_sol_to_buy = amount_sol * 1000000000;
    
    const tokenMint = new PublicKey(token_Address)
    
    const url = "https://quote-api.jup.ag/v6/quote";
    const params = {
        inputMint: solMint.toString(),
        outputMint: tokenMint.toString(),
        amount: amount_sol_to_buy.toString(),  // use the amount_usdc parameter for the amount
        slippage: maxSlippage.toString()
    };
    
    try {
        const quote = await axios.get(url, { params });
        const quoteResponse = quote.data;

        //console.log(`DEBUG: Received swap quote: ${JSON.stringify(quoteResponse, null, 2)}`);

        const swapResponse = await swap(quoteResponse, solMint, tokenMint); // Corrected the parameters here
        if (!swapResponse || !swapResponse.swapTransaction) {
            console.error("Swap failed or swap transaction is missing");
            return;
        }

        //console.log("swap response: " + swapResponse)
        const serializedTransaction = Buffer.from(swapResponse.swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(serializedTransaction);
        transaction.sign([wallet]);  // Sign the transaction with your wallet

        // Send the transaction
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: true,  // Assume Jupiter has already pre-checked the transaction
        });
        console.log("Swap from token to SOL successful with signature:", signature);
        return signature;
    } catch (error) {
        console.error("Error during swap process:", error);
    }
}

async function swap_from_token_to_sol(tokenAmount: number, tokenAddress: String): Promise<string | undefined> {
    try {
        const tokenMint = new PublicKey(tokenAddress);
        const solMint = new PublicKey("So11111111111111111111111111111111111111112");

        const amountToSwap = await getAmountInSmallestUnit(tokenAmount, tokenAddress);

        if (amountToSwap === undefined) {
            console.error("Unable to fetch token decimals for swap.");
            return;
        }

        console.log("*********************************************   TOKEN BALANCE = " + amountToSwap);

        const url = "https://quote-api.jup.ag/v6/quote";
        const params = {
            inputMint: tokenMint.toString(),
            outputMint: solMint.toString(),
            amount: amountToSwap,
            slippage: maxSlippage.toString()
        };

        console.log("DEBUG: REQUESTING QUOTE RESPONSE");
        const quote = await axios.get(url, { params });
        const quoteResponse = quote.data;
        console.log("DEBUG: PRINTING QUOTE RESPONSE");
        console.log(JSON.stringify(quoteResponse, null, 2));

        const swapResponse = await swap(quoteResponse, tokenMint, solMint);
        if (!swapResponse || !swapResponse.swapTransaction) {
            console.error("Swap failed or swap transaction is missing");
            return;
        }

        const serializedTransaction = Buffer.from(swapResponse.swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(serializedTransaction);
        transaction.sign([wallet]);

        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: true,
        });

        console.log("Swap from token to SOL successful with signature:", signature);
        return signature;
    } catch (error) {
        console.error("Error during token to SOL swap process:", error);
    }
}




async function getAmountInSmallestUnit(tokenAmount: number, tokenAddress: String): Promise<string | undefined> {
    const connection = new Connection("https://api.mainnet-beta.solana.com");
    const tokenMint = new PublicKey(tokenAddress);
    const tokenInfo = await connection.getParsedAccountInfo(tokenMint);
    let decimals;

    if (tokenInfo.value?.data) {
        const tokenData = tokenInfo.value.data;
        if ("parsed" in tokenData && tokenData.parsed.info && tokenData.parsed.info.decimals) {
            decimals = tokenData.parsed.info.decimals;
        }
    }

    // If decimals not found, fetch from Dextools API
    if (decimals === undefined) {
        console.log(`Fetching decimals for ${tokenAddress} from Dextools API...`);
        const url = `https://public-api.dextools.io/trial/v2/token/solana/${tokenAddress}`;
        const headers = {
            "accept": "application/json",
            "x-api-key": "t2UZtgUjAH07OL282qRu7hwNvJAmYik4uWY1E4w0"
        };

        try {
            const response = await axios.get(url, { headers });
            if (response.data && response.data.decimals !== undefined) {
                decimals = response.data.decimals;
            } else {
                return undefined;
            }
        } catch (error) {
            console.error("Error fetching decimals from Dextools API:", error);
            return undefined;
        }
    }

    if (decimals !== undefined) {
        const amount = new BigNumber(tokenAmount);
        const factor = new BigNumber(10).pow(decimals);
        return amount.times(factor).integerValue(BigNumber.ROUND_DOWN).toString();
    } else {
        return undefined;
    }
}


//9ba9abe4-5382-46d3-9c67-680bd831ea14   helius key
async function waitForSellTransactionConfirmation(
    signature: TransactionSignature, 
    connection: Connection
): Promise<number> {
    console.log(`Waiting for SOL confirmation for signature: ${signature}`);
    let solAmountChange: number = 0;
    let delay = 3000; // Starting delay of 3 seconds
    const maxDelay = 30000; // Maximum delay of 30 seconds
    const timeout = 120000; // Set timeout to 1 minute
    const startTime = Date.now(); // Record the start time
    const apiKey = '9ba9abe4-5382-46d3-9c67-680bd831ea14'; // Helius API key
    const url = `https://api.helius.xyz/v0/transactions/?api-key=${apiKey}`;

    while (true) {
        if (Date.now() - startTime > timeout) {
            console.log(`Transaction confirmation for ${signature} has timed out.`);
            return 0; // Return 0 if the confirmation process timed out
        }

        try {
            const apiResponse = await axios.post(url, {
                transactions: [signature]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const apiData = apiResponse.data;
            if (apiData.length > 0) {
                const transactionDetails = apiData[0];
                console.log("DEBUG: Transaction details received:", transactionDetails);

                // Assuming the SOL transfer is to the user's account and is of type 'Fungible'
                const solTransfer = transactionDetails.tokenTransfers.find((transfer: TokenTransfer) =>
                    transfer.mint === 'So11111111111111111111111111111111111111112' &&
                    transfer.toUserAccount === '2Y8kvYrfUQjpsskRHdg1iAGiAALdz6XHPrR4JMn1eWke');

                if (solTransfer) {
                    solAmountChange = solTransfer.tokenAmount;
                    console.log(`SOL amount change: ${solAmountChange}`);
                    break; // Exit loop if SOL amount change is found
                } else {
                    console.log("SOL balance change not found or no change.");
                }
            } else {
                console.log(`Transaction ${signature} is not confirmed yet or not found in external API, checking again in ${delay / 1000} seconds...`);
            }
        } catch (error) {
            console.error("An error occurred while fetching transaction details:", error);
            return 0; // Return 0 on error
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, maxDelay); // Exponential back-off
    }

    console.log(`DEBUG: Sell transaction confirmation loop ended. SOL amount received: ${solAmountChange}`);
    return solAmountChange;
}


async function waitForTransactionConfirmation(signature: String, tokenAddress: String): Promise<number> {
    console.log(`Waiting for transaction confirmation for signature: ${signature}`);
    let tokenAmountChange: number = 0;
    let delay = 3000; // Starting delay of 3 seconds
    const maxDelay = 30000; // Maximum delay of 30 seconds
    const timeout = 120000; // Set timeout to 2 minutes
    const startTime = Date.now(); // Record the start time
    const apiKey = '9ba9abe4-5382-46d3-9c67-680bd831ea14'; // Helius API key
    const url = `https://api.helius.xyz/v0/transactions/?api-key=${apiKey}`;

    while (true) {
        if (Date.now() - startTime > timeout) {
            console.log(`Transaction confirmation for ${signature} has timed out.`);
            return 0; // Return 0 if the confirmation process timed out
        }

        try {
            const apiResponse = await axios.post(url, {
                transactions: [signature]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const apiData = apiResponse.data;
            if (apiData.length > 0) {
                const transactionDetails = apiData[0];
                console.log("DEBUG: Transaction details received:", transactionDetails);

                // Finding the relevant token transfer event
                const tokenTransfer = transactionDetails.tokenTransfers.find((transfer: any) =>
                    transfer.mint === tokenAddress
                );

                if (tokenTransfer && tokenTransfer.tokenAmount > 0) {
                    tokenAmountChange = tokenTransfer.tokenAmount;
                    console.log(`Token amount change: ${tokenAmountChange}`);
                    break; // Exit loop if token amount change is found
                } else {
                    console.log("Token transfer not found or no change.");
                }
            } else {
                console.log(`Transaction ${signature} is not confirmed yet or not found in external API, checking again in ${delay / 1000} seconds...`);
            }
        } catch (error) {
            console.error("An error occurred while fetching transaction details:", error);
            return 0; // Return 0 on error
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, maxDelay); // Exponential back-off
    }

    console.log(`DEBUG: Transaction confirmation loop ended. Token amount change: ${tokenAmountChange}`);
    return tokenAmountChange;
}

async function pre_and_post_sell_operations(token_amount: number, token_address: String) {
    try {
        await create_sell_tracker_file_v2();

        console.log("INFO: Performing swap from " + token_amount + " " + token_address + " to SOL ...");
        const signature = await swap_from_token_to_sol(token_amount, token_address); // Ensure swap_from_token_to_sol is defined
        console.log("Swap signature:", signature);

        if (!signature) {
            console.error("No signature returned from swap operation.");
            return false;
        } else {
            console.log("Swap transaction was sent. Signature:", signature);
        }

        const sol_received = await waitForSellTransactionConfirmation(signature, connection);

        const currentDateTime = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''); // Get current UTC time in format 'yyyy-mm-dd hh:mm:ss'

        let amount_received_in_usd: number | null = null;
        if (sol_received !== null && sol_received > 0) {
            amount_received_in_usd = await getAmountInUSD(sol_received);
        } else {
            console.log("No tokens received or transaction is not confirmed");
            return false;
        }

        const data = [{
            date_time: currentDateTime,
            address: token_address,
            token_amount_sold: token_amount,
            sol_received: sol_received,
            profit_in_usd: amount_received_in_usd
        }];

        const csvFilePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/sell_tracker_final.csv";

        let fileHasContent = false;
        try {
            const fileStats = await fs.stat(csvFilePath);
            fileHasContent = fileStats.size > 0;
        } catch (error) {
            // File likely does not exist, which is fine, we'll create it in create_sell_tracker_file_v2()
        }

        const json2csvParser = new Parser({ header: !fileHasContent, includeEmptyRows: false });
        const csv = json2csvParser.parse(data) + '\n'; // Ensure we add a newline after appending data

        await fs.appendFile(csvFilePath, csv, { encoding: 'utf-8' });

        console.log(`Transaction data saved to ${csvFilePath}`);
        
        return signature;
    } catch (error) {
        console.error("Error during swap operation:", error);
    }
}



async function pre_and_post_buy_operations(amount_usd: number, amount_sol: number, token_address: String) {
    try {
        console.log("INFO: Starting pre and post buy operations...");
        await create_transactions_file_V2();

        console.log(`INFO: Attempting to perform swap from ${amount_sol} SOL ($${amount_usd} USD) to token address ${token_address}...`);
        const signature = await swap_from_sol_to_token(amount_sol, token_address);
        //console.log(`DEBUG: Swap operation returned signature: ${signature}`);

        // Use the default commitment level without specifying maxSupportedTransactionVersion
    
        const tokenAmountReceived = await waitForTransactionConfirmation(signature, token_address);

        const currentDateTime = new Date().toISOString();
        let entryPrice: number | null = null;
        if (tokenAmountReceived !== null && tokenAmountReceived > 0) {
            entryPrice = amount_usd / tokenAmountReceived;
        } else {
            console.log("No tokens received or transaction is not confirmed");
            return false;
        }

        const data = [{
            tx_date: currentDateTime,
            address: token_address,
            usd_spent: amount_usd,
            sol_spent: amount_sol,
            tx_state: 'Confirmed',
            entryPrice: entryPrice,
            token_amount_received: tokenAmountReceived
        }];

        const csvFilePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_tracker_final.csv";

        let fileHasContent = false;
        try {
            const fileStats = await fs.stat(csvFilePath);
            if (fileStats.size > 0) {
                fileHasContent = true;
            }
        } catch (error) {
            console.error(error);
        }

        const json2csvParser = new Parser({ header: !fileHasContent, includeEmptyRows: false });
        const csv = json2csvParser.parse(data);

        await fs.appendFile(csvFilePath, csv + '\n', { encoding: 'utf-8' });

        console.log("\nSucessfull BUY: " + tokenAmountReceived + " of " + token_address);
        return signature;
    } catch (error) {
        console.error("Error during pre and post buy operations:", error);
    }
}



async function getSwapAmountReceived(txSignature: string): Promise<number | null> {
    const connection = new Connection("https://api.mainnet-beta.solana.com");

    try {
        const transaction = await connection.getParsedTransaction(txSignature);
        if (!transaction) {
            console.error("Transaction not found");
            return null;
        }

        // Iterate over the transaction instructions
        for (const instruction of transaction.transaction.message.instructions) {
            // Check if the instruction is fully parsed and is a token transfer
            if ("parsed" in instruction && instruction.programId.toString() === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" && instruction.parsed.type === "transfer") {
                const transferInfo = instruction.parsed.info;
                const amountReceived = parseFloat(transferInfo.amount);

                // Return the amount for the transfer instruction
                return amountReceived;
            }
        }

        return null; // If no suitable transfer instruction found
    } catch (error) {
        console.error("Error fetching transaction details:", error);
        return null;
    }
}

async function getAmountInUSD(solAmount: number): Promise<number> {
    const url = "https://public-api.birdeye.so/public/price?address=So11111111111111111111111111111111111111112";
    const headers = { "X-API-KEY": "eccc7565cb0c42ff85c19b64a640d41f" };
    
    try {
        const response = await axios.get(url, { headers });
        const solPrice = response.data.data.value;
        console.log(`SOL Price: ${solPrice}`);

        // Calculate the amount in USD for the given amount of SOL
        const usdAmount = solAmount * solPrice;
        return usdAmount;
    } catch (error) {
        console.error("Error fetching SOL price", error);
        throw error;
    }
}