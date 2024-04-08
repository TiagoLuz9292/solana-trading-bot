import { BigNumber } from 'bignumber.js';
import { promises as fs } from 'fs';
import { Parser } from 'json2csv';
import {get_token_price} from './account_pnl';

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

const solanaEndpoint = "https://api.mainnet-beta.solana.com";
const secretKey = process.env.SECRET_KEY ? JSON.parse(process.env.SECRET_KEY) : null;



const maxSlippage = 49;

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


//9ba9abe4-5382-46d3-9c67-680bd831ea14   helius key
async function waitForSellTransactionConfirmation(
    signature: TransactionSignature, 
    connection: Connection
): Promise<number> {
    console.log(`Waiting for SOL confirmation for signature: ${signature}`);
    let solAmountChange: number = 0;
    let delay = 3000; // Starting delay of 3 seconds
    const maxDelay = 30000; // Maximum delay of 30 seconds
    const timeout = 90000; // Set timeout to 1 minute
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


async function waitForTransactionConfirmation(signature: TransactionSignature, connection: Connection, tokenAddress: String): Promise<number> {
    console.log(`Waiting for transaction confirmation for signature: ${signature}`);
    let tokenAmountChange: number = 0;
    let delay = 3000; // Starting delay of 3 seconds
    const maxDelay = 30000; // Maximum delay of 30 seconds
    const timeout = 90000; // Set timeout to 1 minute
    const startTime = Date.now(); // Record the start time

    while (true) {
        if (Date.now() - startTime > timeout) {
            console.log(`Transaction confirmation for ${signature} has timed out.`);
            return 0; // Return 0 if the confirmation process timed out
        }

        try {
            // Adjust the commitment and maxSupportedTransactionVersion parameters as required
            // If you are sure the latest version is 0, you can set maxSupportedTransactionVersion: 0
            // Otherwise, you may need to check the documentation or remove this parameter
            const response = await connection.getParsedTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0 // This value might need to be updated
            });

            if (response && response.meta && !response.meta.err) {
                const preTokenBalances = response.meta.preTokenBalances || [];
                const postTokenBalances = response.meta.postTokenBalances || [];

                const preBalance = preTokenBalances.find(balance => balance.mint === tokenAddress);
                const postBalance = postTokenBalances.find(balance => balance.mint === tokenAddress);

                if (preBalance && postBalance) {
                    const preAmount = preBalance.uiTokenAmount.uiAmount;
                    const postAmount = postBalance.uiTokenAmount.uiAmount;
                    if (preAmount && postAmount) {
                        tokenAmountChange = postAmount - preAmount;
                        console.log(`Token amount change: ${tokenAmountChange}`);
                        break; // Exit loop if balance is found
                    }
                } else {
                    console.log(`Token balance for ${tokenAddress} not found in pre or post token balances.`);
                }
            } else {
                console.log(`Transaction ${signature} is not confirmed yet, checking again in ${delay / 1000} seconds...`);
            }
        } catch (error) {
            console.error("An error occurred:", error);
            return 0; // Return 0 on error
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, maxDelay); // Exponential back-off
    }

    console.log(`DEBUG: Transaction confirmation loop ended. Token amount change: ${tokenAmountChange}`);
    return tokenAmountChange;
}


(async () => {
    try {
        const sol_received = await waitForSellTransactionConfirmation("4ha5KJWAZD1L5X1vG569jYjXtNfVD4SikPahf9W5ZNHBhBCzh46CczU7jP3RPu4XsB6G6MpJydJEWoihDUDG7ycM", connection);
    } catch (error) {
        console.error("Error in processing:", error);
    }
})();

