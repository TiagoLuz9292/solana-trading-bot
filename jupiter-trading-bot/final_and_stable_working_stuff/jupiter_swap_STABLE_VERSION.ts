/*
NOW IT SAVES TRANSACTIONS TO FILES, AND MY WALLET SCRIPT CHECKS IF IT WAS COMPLETED AND UPDATES IT

THIS IS THE MAIN ONE

*/
import { ObjectId } from 'mongodb';
import {process_sell} from './transaction_manager'
import { BigNumber } from 'bignumber.js';
import { insertDocument } from './mongoDB_connection';
import { promises as fs } from 'fs';
import { Parser } from 'json2csv';
import {get_token_price} from './account_pnl';
export { swap_from_usdc_to_token as swap_from_sol_to_token, swap_from_token_to_sol, pre_and_post_buy_operations_for_buy_manual, pre_and_post_sell_operations, pre_and_post_buy_operations_v2, pre_and_post_sell_operations_v2};
import { getAllBalances, getTokenBalance } from './my_wallet';
import { create_sell_tracker_file, create_sell_tracker_file_v2, create_transactions_file, create_transactions_file_V2 } from './file_manager';
import { Keypair, Connection, ParsedConfirmedTransaction, TransactionSignature, TokenBalance, PublicKey, ParsedInstruction, Transaction, VersionedTransaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, MintLayout } from "@solana/spl-token";
import dotenv from "dotenv";
import axios from "axios";
import { log } from 'console';
import path from 'path';
import fetch from 'node-fetch';
import { format } from 'date-fns';
import {send_message} from './telegram_bot';
import {update_pnl_after_buy_v2, update_account_PNL_v3, update_sell_tracker_after_sell} from '/root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/account_pnl';






dotenv.config({ path: '/root/project/solana-trading-bot/jupiter-trading-bot/.env' });

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
const solanaEndpoint = "https://api.mainnet-beta.solana.com";



const secretKey = process.env.SECRET_KEY ? JSON.parse(process.env.SECRET_KEY) : null;



const maxSlippage = 4900;

const web3 = require('@solana/web3.js');

const connection = new web3.Connection('https://serene-soft-dream.solana-mainnet.quiknode.pro/d9545d21916469751695fb7a165e97325634fdb5', 'confirmed');
    'confirmed'







const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));








console.log(`Wallet: ${wallet.publicKey.toBase58()}\n`)

//const connection = new Connection(solanaEndpoint, 'confirmed');

const solMint = new PublicKey("So11111111111111111111111111111111111111112");
const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

interface mongoDB_buy {
    _id: ObjectId;
    tx_date: string;
    tx_state: string;
    address: String;
    signature: string;
    symbol: String;
    usd_spent?: number;
    token_amount_received?: number;
    entry_price?: number;
  }


interface TransactionData {
    tx_date: string;
    address: String;
    signature: String;
    symbol: String;
    usd_spent: number;
    sol_spent: number;
    entryPrice: number;
    token_amount_received: number;
}


interface TokenToSellMongo {
    address: String;
    token_amount_sold: number;
    profit_in_usd: number;
    message: String;
}

interface TokenToSell {
    date_time: string;
    address: String;
    symbol: String;
    token_amount_sold: number;
    profit_in_usd: number;
    message: String;
}

/*
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

*/
/*
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
            prioritizationFeeLamports: 50000,
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

*/


async function ensureAssociatedTokenAccount_v2(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    
    //await sleep(5000); // Might want to adjust this based on actual needs
    const associatedTokenAddress = await getAssociatedTokenAddress(mint, owner);
    const accountInfo = await connection.getAccountInfo(associatedTokenAddress);

    if (!accountInfo) {
        console.log(`Creating associated token account for ${mint.toString()} owned by ${owner.toString()}`);
        const transaction = new Transaction().add(
            createAssociatedTokenAccountInstruction(owner, associatedTokenAddress, owner, mint)
        );
        try {
            // Now we catch potential errors during transaction send
            await sendAndConfirmTransaction(connection, transaction, [wallet], {
                preflightCommitment: 'finalized'
            });
        } catch (error) {
            console.error(`Error creating associated token account: ${error}`);
            throw error; // Rethrowing the error after logging it
        }
    } else {
        console.log(`Associated token account ${associatedTokenAddress.toString()} already exists.`);
    }

    return associatedTokenAddress;
}

async function swap_v2(quoteResponse: any, sourceMint: PublicKey, destinationMint: PublicKey) {
    const sourceTokenAccount = await ensureAssociatedTokenAccount_v2(sourceMint, wallet.publicKey);
    console.log("SOL associated token account created:", sourceTokenAccount.toString());
    const destinationTokenAccount = await ensureAssociatedTokenAccount_v2(destinationMint, wallet.publicKey);
    console.log("Output token associated token account created:", destinationTokenAccount.toString());

    if (!quoteResponse || !quoteResponse.routePlan || quoteResponse.routePlan.length === 0) {
        throw new Error("Invalid quote response or empty route plan");
    }
    
    const payload = {
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        useSharedAccounts: true,
        //feeAccount: wallet.publicKey.toString(),
        prioritizationFeeLamports: 25000,
        asLegacyTransaction: false,
        useTokenLedger: false,
        destinationTokenAccount: destinationTokenAccount.toString(),
        dynamicComputeUnitLimit: true,
        skipUserAccountsRpcCalls: true,
        quoteResponse: quoteResponse
    };

    try {
        const response = await axios.post("https://quote-api.jup.ag/v6/swap", payload, {
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
        });

        if (response.data.error) {
            console.error("Error from Jupiter API:", response.data.error);
            throw new Error(`Error from Jupiter API: ${response.data.error}`);
        }

        if (!response.data.swapTransaction) {
            console.error("Swap transaction is missing in API response.");
            throw new Error("Swap transaction is missing");
        }

        const serializedTransaction = Buffer.from(response.data.swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(serializedTransaction);
        transaction.sign([wallet]);

        const simulationResult = await connection.simulateTransaction(transaction);
        if (simulationResult.value.err) {
            console.error("Simulation error:", JSON.stringify(simulationResult.value.err));
            throw new Error(`Simulation error: ${JSON.stringify(simulationResult.value.err)}`);
        }

        const signature = await connection.sendRawTransaction(transaction.serialize());
        console.log("Transaction sent, signature:", signature);

        
        return signature;
        
    } catch (error) {
        console.error("Swap failed:", error);
        throw error;
    }
}



async function swap_from_usdc_to_token(amount_usd : number, token_Address : String) {
    //console.log("INFO: Initiating swap from SOL to token...");
   
    const amountUSDtoBUY = await getAmountInSmallestUnit_v2(amount_usd, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    
    const tokenMint = new PublicKey(token_Address)
    
    const url = "https://quote-api.jup.ag/v6/quote";
    const params = {
        inputMint: usdcMint.toString(),
        outputMint: tokenMint.toString(),
        amount: amountUSDtoBUY, 
        slippageBps: maxSlippage.toString()
    };
    
    try {
        const quote = await axios.get(url, { params });
        const quoteResponse = quote.data;
        console.log("TEST");

        console.log(`DEBUG: Received swap quote: ${JSON.stringify(quoteResponse, null, 2)}`);
        
        const signature = await swap_v2(quoteResponse, usdcMint, tokenMint); // Corrected the parameters here
        
        /*
        if (!swapResponse || !swapResponse.swapTransaction) {
            console.error("Swap failed or swap transaction is missing");
            return;
        }

        /*

        //console.log("swap response: " + swapResponse)
        const serializedTransaction = Buffer.from(swapResponse.swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(serializedTransaction);
        transaction.sign([wallet]);  // Sign the transaction with your wallet

        // Send the transaction
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: true,  // Assume Jupiter has already pre-checked the transaction
        });

        */
        console.log("Swap from token to SOL successful with signature:", signature);
        return signature;
    } catch (error) {
        console.error("Error during swap process:", error);
    }
}

async function swap_from_token_to_sol(tokenAmount: number, tokenAddress: String): Promise<string | undefined> {
    try {
        const tokenMint = new PublicKey(tokenAddress);
        

        const amountToSwap = await getAmountInSmallestUnit_v2(tokenAmount, tokenAddress);

        if (amountToSwap === undefined) {
            console.error("Unable to fetch token decimals for swap.");
            return;
        }

        console.log("*********************************************   TOKEN BALANCE = " + amountToSwap);

        const url = "https://quote-api.jup.ag/v6/quote";
        const params = {
            inputMint: tokenMint.toString(),
            outputMint: usdcMint.toString(),
            amount: amountToSwap,
            slippageBps: maxSlippage.toString()
        };

        console.log("DEBUG: REQUESTING QUOTE RESPONSE");
        const quote = await axios.get(url, { params });
        const quoteResponse = quote.data;
        console.log("DEBUG: PRINTING QUOTE RESPONSE");
        console.log(JSON.stringify(quoteResponse, null, 2));

        const signature = await swap_v2(quoteResponse, tokenMint, usdcMint);

        /*
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

        */
        return signature;
    } catch (error) {
        console.error("Error during token to SOL swap process:", error);
    }
}


async function getAmountInSmallestUnit_v2(tokenAmount: number, tokenAddress: String): Promise<string | undefined> {
    const tokenMint = new PublicKey(tokenAddress);
    const mintAccountInfo = await connection.getAccountInfo(tokenMint);

    let decimals;

    if (mintAccountInfo && mintAccountInfo.data) {
        // Decode the data using MintLayout from SPL Token library
        const mintData = MintLayout.decode(mintAccountInfo.data);
        decimals = mintData.decimals;
    }

    // If decimals are still undefined after fetching directly, log an error (optional)
    if (decimals === undefined) {
        console.error(`Decimals not found for token at address: ${tokenAddress}`);
        return undefined;
    }

    // Calculate the smallest unit
    const amount = new BigNumber(tokenAmount);
    const factor = new BigNumber(10).pow(decimals);
    return amount.times(factor).integerValue(BigNumber.ROUND_DOWN).toString();
}

async function getAmountInSmallestUnit(tokenAmount: number, tokenAddress: String): Promise<string | undefined> {
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
    console.log(`Waiting for USDC confirmation for signature: ${signature}`);
    let usdcAmountChange: number = 0;
    let delay = 3000; // Starting delay of 3 seconds
    const maxDelay = 30000; // Maximum delay of 30 seconds
    const timeout = 120000; // Set timeout to 1 minute 30 seconds
    const startTime = Date.now(); // Record the start time
    const apiKey = '718ea21d-2d9d-49e2-b3f2-46888e0fcb25'; // Your API key
    const url = `https://api.helius.xyz/v0/transactions/?api-key=${apiKey}`;

    while (true) {
        if (Date.now() - startTime > timeout) {
            console.log(`Transaction confirmation for ${signature} has timed out.`);
            return 0; // Return 0 if the confirmation process timed out
        }

        try {
            console.log("ABOUT TO REQUEST FROM HELIUS")
            await delayy(5000);
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

                if (transactionDetails.transactionError === null) {
                    // Filter the token transfers for USDC transfers to the user's account
                    const usdcTransfer = transactionDetails.tokenTransfers.find((transfer: any) =>
                        transfer.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' &&
                        transfer.toUserAccount === '2Y8kvYrfUQjpsskRHdg1iAGiAALdz6XHPrR4JMn1eWke'); // Replace with your actual public key

                    if (usdcTransfer) {
                        usdcAmountChange = parseFloat(usdcTransfer.tokenAmount);
                        console.log(`USDC amount change: ${usdcAmountChange}`);
                        break; // Exit loop if USDC amount change is found
                    } else {
                        console.log("USDC balance change not found or no change.");
                    }
                } else {
                    console.log("There was an error on the transaction.");
                    return 0;
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

    console.log(`DEBUG: Sell transaction confirmation loop ended. USDC amount received: ${usdcAmountChange}`);
    return usdcAmountChange;
}
function delayy(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForTransactionConfirmation(signature: String, tokenAddress: String): Promise<number> {
    console.log(`Waiting for transaction confirmation for signature: ${signature}`);
    let tokenAmountChange: number = 0;
    let delay = 3000; // Starting delay of 3 seconds
    const maxDelay = 30000; // Maximum delay of 30 seconds
    const timeout = 120000; // Set timeout to 2 minutes
    const startTime = Date.now(); // Record the start time
    const apiKey = '718ea21d-2d9d-49e2-b3f2-46888e0fcb25'; // Helius API key
    const url = `https://api.helius.xyz/v0/transactions/?api-key=${apiKey}`;

    while (true) {
        if (Date.now() - startTime > timeout) {
            console.log(`Transaction confirmation for ${signature} has timed out.`);
            return 0; // Return 0 if the confirmation process timed out
        }

        try {
            console.log("ABOUT TO REQUEST FROM HELIUS")
            await delayy(5000);
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

                if (transactionDetails.transactionError === null) {
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
                    console.log("There was an error on the transaction.");
                    return 0;
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

async function pre_and_post_sell_operations(token_amount: number, token_address: String, symbol: String, message: String) {
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

        const usdc_received = await waitForSellTransactionConfirmation(signature, connection);
        
        // Get the current date in UTC in ISO format
        const now = new Date();
        const isoDate = now.toISOString();
        // Extract the date and time parts from the ISO string
        const datePart = isoDate.slice(0, 10); // yyyy-mm-dd
        const timePart = isoDate.slice(11, 19); // hh:mm:ss
        // Format the date string as needed
        const currentDateTime = format(new Date(datePart + ' ' + timePart), 'dd-MM-yyyy HH:mm:ss');

        let amount_received_in_usd: number | null = null;
        if (!usdc_received) {
            console.log("No tokens received or transaction is not confirmed");
           return false;
        } 

        const data: TokenToSell[] = [{
            date_time: currentDateTime,
            address: token_address,
            symbol: symbol,
            token_amount_sold: token_amount,
            profit_in_usd: usdc_received,
            message: message
        }];

        update_sell_tracker_after_sell(data);


    

        console.log(`\nSucessfull SELL: ${token_amount} of ${symbol}-${token_address}; Received $${usdc_received} USDC`);
        
        return signature;
    } catch (error) {
        console.error("Error during swap operation:", error);
    }
}





async function pre_and_post_sell_operations_v2(token_amount: number, token_address: String, symbol: String, message: String) {
    try {
        

        console.log("INFO: Performing swap from " + token_amount + " " + token_address + " to SOL ...");
        const signature = await swap_from_token_to_sol(token_amount, token_address); // Ensure swap_from_token_to_sol is defined
        console.log("Swap signature:", signature);

        if (!signature) {
            console.error("No signature returned from swap operation.");
            return false;
        } else {
            console.log("Swap transaction was sent. Signature:", signature);
        }

        const usdc_received = await waitForSellTransactionConfirmation(signature, connection);
        
        // Get the current date in UTC in ISO format
        const now = new Date();
        const isoDate = now.toISOString();
        // Extract the date and time parts from the ISO string
        const datePart = isoDate.slice(0, 10); // yyyy-mm-dd
        const timePart = isoDate.slice(11, 19); // hh:mm:ss
        // Format the date string as needed
        const currentDateTime = format(new Date(datePart + ' ' + timePart), 'dd-MM-yyyy HH:mm:ss');

        let amount_received_in_usd: number | null = null;
        if (!usdc_received) {
            console.log("No tokens received or transaction is not confirmed");
           return false;
        } 

        const data: TokenToSellMongo = {
            address: token_address,
            token_amount_sold: token_amount,
            profit_in_usd: usdc_received,
            message: message
        };

        await process_sell(data);


    

        console.log(`\nSucessfull SELL: ${token_amount} of ${symbol}-${token_address}; Received $${usdc_received} USDC`);
        
        return signature;
    } catch (error) {
        console.error("Error during swap operation:", error);
    }
}






async function pre_and_post_buy_operations_v2(amount_usd: number, amount_sol: number, token_address: String, symbol: String) {
    try {
        console.log(`INFO: Attempting to perform swap from ${amount_usd} USDT ($${amount_usd} USD) to token address ${token_address}...`);
        const signature = await swap_from_usdc_to_token(amount_usd, token_address);
    
        // Generate new ObjectId
        const newId = new ObjectId();

        const now = new Date();
        const isoDate = now.toISOString();
        const datePart = isoDate.slice(0, 10); // yyyy-mm-dd
        const timePart = isoDate.slice(11, 19); // hh:mm:ss
        const currentDateTime = format(new Date(datePart + ' ' + timePart), 'dd-MM-yyyy HH:mm:ss');

        const mongo_buy: mongoDB_buy = {
            _id: newId, // Provide new ObjectId
            tx_date: currentDateTime,
            tx_state: "pending",
            address: token_address,
            signature: signature,
            symbol: symbol,
            entry_price: 0,
            usd_spent: 0,
            token_amount_received: 0
        };

        console.log("DEBUG: About to insert buy into MongoDB!")
        insertDocument(mongo_buy);
        
    } catch (error) {
        console.error("Error during pre and post buy operations:", error);
    }
}

async function pre_and_post_buy_operations_for_buy_manual(amount_usd: number, token_address: String, symbol: String) {
    try {
        console.log(`INFO: Attempting to perform swap from ${amount_usd} USDT ($${amount_usd} USD) to token address ${token_address}...`);
        const signature = await swap_from_usdc_to_token(amount_usd, token_address);
    
        // Generate new ObjectId
        const newId = new ObjectId();

        const now = new Date();
        const isoDate = now.toISOString();
        const datePart = isoDate.slice(0, 10); // yyyy-mm-dd
        const timePart = isoDate.slice(11, 19); // hh:mm:ss
        const currentDateTime = format(new Date(datePart + ' ' + timePart), 'dd-MM-yyyy HH:mm:ss');

        const mongo_buy: mongoDB_buy = {
            _id: newId, // Provide new ObjectId
            tx_date: currentDateTime,
            tx_state: "pending",
            address: token_address,
            signature: signature,
            symbol: symbol,
            entry_price: 0,
            usd_spent: 0,
            token_amount_received: 0
        };

        console.log("DEBUG: About to insert buy into MongoDB!")
        //insertDocument(mongo_buy);
        
    } catch (error) {
        console.error("Error during pre and post buy operations:", error);
    }
}


async function sendSol(receiverAddress: string, amountSol: number): Promise<string> {
    
    const receiver = new PublicKey(receiverAddress);

    // Create a transaction for sending SOL
    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: wallet.publicKey,  // Use the globally available 'wallet' Keypair
            toPubkey: receiver,
            lamports: amountSol * LAMPORTS_PER_SOL  // Convert SOL to lamports
        })
    );

    // Sign and send the transaction
    try {
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [wallet],  // Use the 'wallet' Keypair for signing the transaction
            { commitment: "confirmed" }
        );
        console.log(`Transaction successful with signature: ${signature}`);
        return signature;
    } catch (error) {
        console.error('Transaction failed:', error);
        throw error;
    }
}