
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



dotenv.config();

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
const solanaEndpoint = "https://api.mainnet-beta.solana.com";
const secretKey = process.env.SECRET_KEY ? JSON.parse(process.env.SECRET_KEY) : null;

const maxSlippage = 49;

const web3 = require('@solana/web3.js');

const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

console.log(`Wallet: ${wallet.publicKey.toBase58()}\n`)

const connection = new Connection('https://serene-soft-dream.solana-mainnet.quiknode.pro/d9545d21916469751695fb7a165e97325634fdb5', 'confirmed');

const solMint = new PublicKey("So11111111111111111111111111111111111111112");
const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

async function ensureAssociatedTokenAccount(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    sleep(5000);
    const associatedTokenAddress = await getAssociatedTokenAddress(mint, owner);
    const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
    
    if (!accountInfo) {
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
    }

    return associatedTokenAddress;
}

async function swap(quoteResponse: any, sourceMint: PublicKey, destinationMint: PublicKey) {
    
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

async function swap_v2(quoteResponse: any, sourceMint: PublicKey, destinationMint: PublicKey) {
    
    const sourceTokenAccount = await ensureAssociatedTokenAccount(sourceMint, wallet.publicKey);
    const destinationTokenAccount = await ensureAssociatedTokenAccount(destinationMint, wallet.publicKey);

    if (quoteResponse && quoteResponse.routePlan && quoteResponse.routePlan.length > 0) {
        const payload = {
            userPublicKey: wallet.publicKey.toString(),
            wrapAndUnwrapSol: true,
            useSharedAccounts: true,
            //feeAccount: wallet.publicKey.toString(),
            prioritizationFeeLamports: 1250000,
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

async function swap_from_token_to_sol(tokenAmount: number, tokenAddress: String): Promise<string | undefined>  {
    try {
        const tokenMint = new PublicKey(tokenAddress);
        const solMint = new PublicKey("So11111111111111111111111111111111111111112"); // This is the public key for SOL

        // Convert tokenAmount to the smallest unit using the getAmountInSmallestUnit function


        
        const amountToSwap = await getAmountInSmallestUnit(tokenAmount, tokenAddress);

        console.log("*********************************************   TOKEN BALANCE = " + amountToSwap)

        const url = "https://quote-api.jup.ag/v6/quote";
        const params = {
            inputMint: tokenMint.toString(),
            outputMint: solMint.toString(),
            amount: amountToSwap.toString(),  // Now amountToSwap should be in the correct smallest unit
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
        transaction.sign([wallet]); // Sign the transaction with your wallet

        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: true, // Assume Jupiter has already pre-checked the transaction
        });

        console.log("Swap from token to SOL successful with signature:", signature);
        return signature;
    } catch (error) {
        console.error("Error during token to SOL swap process:", error);
    }
}




async function getAmountInSmallestUnit(tokenAmount: number, tokenAddress: String): Promise<string> {
    const connection = new Connection("https://api.mainnet-beta.solana.com");
    const tokenMint = new PublicKey(tokenAddress);
    const tokenInfo = await connection.getParsedAccountInfo(tokenMint);

    if (tokenInfo.value?.data) {
        const tokenData = tokenInfo.value.data;
        if ("parsed" in tokenData && tokenData.parsed.info && tokenData.parsed.info.decimals) {
            const decimals = tokenData.parsed.info.decimals;
            const amount = new BigNumber(tokenAmount);
            const factor = new BigNumber(10).pow(decimals);
            return amount.times(factor).integerValue(BigNumber.ROUND_DOWN).toString(); // Ensures an integer value
        } else {
            console.error("Parsed data is missing or does not contain 'info' with 'decimals'");
            throw new Error("Token data does not have parsed information.");
        }
    } else {
        console.error("Failed to fetch token information or data is missing in the response");
        throw new Error("Could not fetch token information");
    }
}

async function waitForTransactionConfirmation(signature: TransactionSignature, connection: Connection): Promise<number | null> {
    console.log(`Waiting for transaction confirmation for signature: ${signature}`);
    
    let tokenAmountReceived: number | null = null;

    while (true) {
        const response: ParsedConfirmedTransaction | null = await connection.getParsedConfirmedTransaction(signature, 'confirmed');

        // Check if the response and its meta property are not null
        if (response && response.meta && !response.meta.err) {
            const postTokenBalances = response.meta.postTokenBalances;
            if (postTokenBalances && postTokenBalances.length > 0) {
                // Find the balance where the uiAmount is greater than 0
                const receivedTokenBalance = postTokenBalances.find(balance => 
                    balance.uiTokenAmount && balance.uiTokenAmount.uiAmount !== null && balance.uiTokenAmount.uiAmount > 0
                );
                if (receivedTokenBalance) {
                    tokenAmountReceived = receivedTokenBalance.uiTokenAmount.uiAmount;
                    break; // Exit the loop if a balance is found
                }
            }
        } else {
            console.log(`Transaction ${signature} is not confirmed yet, checking again in a few seconds...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    return tokenAmountReceived;
}

async function pre_and_post_buy_operations(amount_usd: number, amount_sol: number, token_address: String) {
    try {
        await create_transactions_file_V2();
        const signature = await swap_from_sol_to_token(amount_sol, token_address);
        console.log("Swap signature:", signature);

        if (!signature) {
            console.error("No signature returned from swap operation.");
            return;
        }

        // Specify the commitment level and maxSupportedTransactionVersion when creating the connection
        const connection = new web3.Connection(
            web3.clusterApiUrl('mainnet-beta'), 
            {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0   
            }
        );

        const tokenAmountReceived = await waitForTransactionConfirmation(signature, connection);
        // ... rest of your code

        const currentDateTime = new Date().toISOString();

        // Ensure tokenAmountReceived is not null and greater than zero before calculating the entryPrice
        let entryPrice: number | null = null;
        if (tokenAmountReceived !== null && tokenAmountReceived > 0) {
            entryPrice = amount_usd / tokenAmountReceived;
        } else {
            console.log("No tokens received or transaction is not confirmed");
        }

        const data = [{
            tx_date: currentDateTime,
            address: token_address,
            usd_spent: amount_usd,
            sol_spent: amount_sol,
            tx_state: 'Confirmed',
            entryPrice: entryPrice,
            token_amount_received: tokenAmountReceived,
            // You can add other fields as needed
        }];

        const csvFilePath = "/path/to/your/transactions.csv";

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

        console.log("Transaction confirmed and saved to csv file.");
        return signature;
    } catch (error) {
        console.error("Error during pre and post buy operations:", error);
    }
}

async function pre_and_post_sell_operations(token_amount: number, token_address: String): Promise<void> {
    try {
        await create_sell_tracker_file_v2();

        console.log("Inside pre_and_post_sell_operations, about to ask for token price");
        const token_price = await get_token_price(token_address); // Make sure get_token_price is defined and works
        const usd_profit = token_price * token_amount;
        const signature = await swap_from_token_to_sol(token_amount, token_address); // Ensure swap_from_token_to_sol is defined
        console.log("Swap signature:", signature);

        const data = [{
            date_time: new Date().toISOString(),
            address: token_address,
            token_amount_sold: token_amount,
            sol_received: null, // You might need to update this after the swap operation to reflect the SOL received
            profit_in_usd: usd_profit
        }];

        const csvFilePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/buy_BOT/sell_tracker_v3.csv";

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

        console.log("Transaction saved to csv file.");
        console.log(`Transaction data saved to ${csvFilePath}`);
    } catch (error) {
        console.error("Error during swap operation:", error);
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


/*
(async () => {
    const args = process.argv.slice(2);
    console.log("System Arguments:", args);

    const operation = args[0];
    


    if (operation === 'from-sol') {
        const token_address = args[3];
        const amount_usd = parseFloat(args[1]);
        const amount_sol = parseFloat(args[2]);
    

        await pre_and_post_buy_operations(amount_usd, amount_sol, token_address)

    }
    if (operation === 'to-sol') {
        const token_address = args[2];
        const amount_token = parseFloat(args[1]);
        console.log(amount_token);
        try {
            const signature = await swap_from_token_to_sol(amount_token, token_address);
            console.log("Swap signature:", signature);
        } catch (error) {
            console.error("Error during swap operation:", error);
        }
    }


})();
*/


//swap_tokens(1000000, "EWnBehhDnuJ7TAJuqdyxFMXryi8VYCgkZjDRqb9ja7MC", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
//swap_from_token_to_sol(15458, "EWnBehhDnuJ7TAJuqdyxFMXryi8VYCgkZjDRqb9ja7MC");
//swap_from_sol_to_token(0.0025 ,'5M6kZ95iH2LPoHrGT358e45ygHAmtYKDKAe9gi1JbkxT')
// 1000000 = 1$ 0,049682012 
//get_quote_for_swap_from_sol_to_token(2480, "5M6kZ95iH2LPoHrGT358e45ygHAmtYKDKAe9gi1JbkxT")
//get_quote_for_swap_from_token_to_sol(2480, "5M6kZ95iH2LPoHrGT358e45ygHAmtYKDKAe9gi1JbkxT")
