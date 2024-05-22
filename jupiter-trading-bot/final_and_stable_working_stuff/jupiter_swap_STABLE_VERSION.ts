/*
NOW IT SAVES TRANSACTIONS TO FILES, AND MY WALLET SCRIPT CHECKS IF IT WAS COMPLETED AND UPDATES IT

THIS IS THE MAIN ONE

*/
import { Db, ObjectId } from 'mongodb';
import {process_sell, waitForTransactionConfirmation} from './transaction_manager'
import { BigNumber } from 'bignumber.js';
import { insertDocument, connectToDatabase, getDatabase } from './mongoDB_connection';
import { promises as fs } from 'fs';
import { Parser } from 'json2csv';
import {get_token_price} from './account_pnl';
export { swap_from_usdc_to_token as swap_from_sol_to_token, swap_from_token_to_sol, pre_and_post_buy_operations_for_buy_manual, pre_and_post_sell_operations, pre_and_post_buy_operations_v2, pre_and_post_sell_operations_v2};
import { getAllBalances, getTokenBalance } from './my_wallet';

import { Keypair, Connection, ParsedConfirmedTransaction, TransactionSignature, TokenBalance, PublicKey, ParsedInstruction, Transaction, VersionedTransaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, MintLayout, getOrCreateAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token";
import dotenv from "dotenv";
import axios from "axios";
import { log } from 'console';
import path from 'path';
import fetch from 'node-fetch';
import { format } from 'date-fns';
import {send_message} from './telegram_bot';
import {update_pnl_after_buy_v2, update_account_PNL_v3, update_sell_tracker_after_sell} from '/root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/account_pnl';
import { createDecipheriv } from 'crypto';
import WebSocket from 'ws';
import { send_message_to_telegramId } from './telegram_public_sniper_bot';






dotenv.config({ path: '/root/project/solana-trading-bot/jupiter-trading-bot/.env' });

const encryptionKey = process.env.ENCRYPTION_KEY!;
if (!encryptionKey || Buffer.from(encryptionKey).length !== 32) {
    console.error("Encryption key is not set correctly in the environment. It must be 32 bytes.");
    process.exit(1); // Exit if the encryption key is not set correctly
}

const decryptText = (text: string) => {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
};


const solanaEndpoint = "https://api.mainnet-beta.solana.com";





const maxSlippage = 9900;

const web3 = require('@solana/web3.js');

const connection = new web3.Connection('https://serene-soft-dream.solana-mainnet.quiknode.pro/d9545d21916469751695fb7a165e97325634fdb5/', 'confirmed');
    'confirmed'


//console.log(`Wallet: ${wallet.publicKey.toBase58()}\n`)
//const connection = new Connection(solanaEndpoint, 'confirmed');

const solMint = new PublicKey("So11111111111111111111111111111111111111112");
const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const referralAccountPubkey = new PublicKey("BmmUTUfjZ1FiLHzfHDReihWAzMNv38C94yWC8TxUYGWu");
const platform_fee_bps = 200;

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

async function ensureAssociatedTokenAccount_v2(mint: PublicKey, owner: PublicKey, wallet: Keypair): Promise<PublicKey> {
  const associatedTokenAddress = await getAssociatedTokenAddress(mint, owner);
  const accountInfo = await connection.getAccountInfo(associatedTokenAddress);

  if (!accountInfo) {
    console.log(`Creating associated token account for ${mint.toString()} owned by ${owner.toString()}`);
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(wallet.publicKey, associatedTokenAddress, wallet.publicKey, mint)
    );

    // Fetch recent blockhash and set it in the transaction
    const { blockhash } = await connection.getRecentBlockhash();
    transaction.recentBlockhash = blockhash;

    try {
      transaction.sign(wallet);
      const serializedTransaction = transaction.serialize();
      console.log("Serialized Transaction:", serializedTransaction.toString('base64'));

      const signature = await connection.sendRawTransaction(serializedTransaction);
      console.log(`Associated token account created with signature: ${signature}`);
    } catch (error) {
      console.error(`Error creating associated token account: ${error}`);
      throw error;
    }
  } else {
    console.log(`Associated token account ${associatedTokenAddress.toString()} already exists.`);
  }

  return associatedTokenAddress;
}

async function swap_v2(quoteResponse: any, sourceMint: PublicKey, destinationMint: PublicKey, wallet: Keypair) {

  console.log("inside swap_v2")   


  const sourceTokenAccount = await ensureAssociatedTokenAccount_v2(sourceMint, wallet.publicKey, wallet);
  console.log("SOL associated token account created:", sourceTokenAccount.toString());
  const destinationTokenAccount = await ensureAssociatedTokenAccount_v2(destinationMint, wallet.publicKey, wallet);
  console.log("Output token associated token account created:", destinationTokenAccount.toString());

  if (!quoteResponse || !quoteResponse.routePlan || quoteResponse.routePlan.length === 0) {
    throw new Error("Invalid quote response or empty route plan");
  }

  

  const payload = {
    userPublicKey: wallet.publicKey.toString(),
    wrapAndUnwrapSol: true,
    useSharedAccounts: true,
    prioritizationFeeLamports: 100000,
    asLegacyTransaction: false,
    useTokenLedger: false,
    destinationTokenAccount: destinationTokenAccount.toString(),
    dynamicComputeUnitLimit: true,
    skipUserAccountsRpcCalls: true,
    quoteResponse: quoteResponse,
  };

  try {
    const response = await axios.post("https://quote-api.jup.ag/v6/swap", payload, {
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    });

    if (response.data.error) {
      console.error("Error from Jupiter API:", response.data.error);
      throw new Error(`Error from Jupiter API: ${response.data.error}`);
    }

    if (!response.data.swapTransaction) {
      console.error("Swap transaction is missing in API response.");
      throw new Error("Swap transaction is missing");
    }

    const serializedTransaction = Buffer.from(response.data.swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(serializedTransaction);

    // Fetch recent blockhash and set it in the transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.message.recentBlockhash = blockhash;

    // Sign the transaction
    transaction.sign([wallet]);

    // Serialize transaction after signing
    const serializedWithSignatures = transaction.serialize();
    
    // Fix for TypeScript error related to console.log
    
    /*
    const simulationResult = await connection.simulateTransaction(transaction);
    if (simulationResult.value.err) {
      console.error("Simulation error:", JSON.stringify(simulationResult.value.err));
      throw new Error(`Simulation error: ${JSON.stringify(simulationResult.value.err)}`);
    }
    */
    const signature = await connection.sendRawTransaction(serializedWithSignatures);
    console.log("Transaction sent, signature:", signature);

    return signature;
  } catch (error) {
    console.error("Swap failed:", error);
    throw error;
  }
}


async function swap_from_usdc_to_token(amount_usd: number, token_Address: string, wallet: Keypair) {
  const amountUSDtoBUY = await getAmountInSmallestUnit_v2(amount_usd, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  const tokenMint = new PublicKey(token_Address);
  const url = "https://quote-api.jup.ag/v6/quote";
  const params = {
    inputMint: usdcMint.toString(),
    outputMint: tokenMint.toString(),
    amount: amountUSDtoBUY,
    slippageBps: maxSlippage.toString(),
  };

  try {
    const quote = await axios.get(url, { params });
    const quoteResponse = quote.data;
    console.log(`DEBUG: Received swap quote: ${JSON.stringify(quoteResponse, null, 2)}`);
    const signature = await swap_v2(quoteResponse, usdcMint, tokenMint, wallet);
    console.log("Swap from token to SOL successful with signature:", signature);
    return signature;
  } catch (error) {
    console.error("Error during swap process:", error);
  }
}

async function swap_from_token_to_sol(tokenAmount: number, tokenAddress: String, wallet: Keypair): Promise<string | undefined> {
  try {
    const tokenMint = new PublicKey(tokenAddress);
    const amountToSwap = await getAmountInSmallestUnit_v2(tokenAmount, tokenAddress.toString());

    if (amountToSwap === undefined) {
      console.error("Unable to fetch token decimals for swap.");
      return;
    }

    const url = "https://quote-api.jup.ag/v6/quote";
    const params = {
      inputMint: tokenMint.toString(),
      outputMint: usdcMint.toString(),
      amount: amountToSwap,
      slippageBps: maxSlippage.toString(),
    };

    const quote = await axios.get(url, { params });
    const quoteResponse = quote.data;
    console.log(`DEBUG: Received swap quote: ${JSON.stringify(quoteResponse, null, 2)}`);
    const signature = await swap_v2(quoteResponse, tokenMint, usdcMint, wallet);
    console.log("Swap from token to SOL successful with signature:", signature);
    return signature;
  } catch (error) {
    console.error("Error during token to SOL swap process:", error);
  }
}

async function getAmountInSmallestUnit_v2(tokenAmount: number, tokenAddress: string): Promise<string | undefined> {
  // Assume USDC address and handle it specifically
  const isUSDC = tokenAddress === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  
  // Get mint account information
  const tokenMint = new PublicKey(tokenAddress);
  const mintAccountInfo = await connection.getAccountInfo(tokenMint);
  if (!mintAccountInfo || !mintAccountInfo.data) {
    console.error(`Failed to fetch mint account info for token at address: ${tokenAddress}`);
    return undefined;
  }

  // Decode the mint information to get decimals
  const mintData = MintLayout.decode(mintAccountInfo.data);
  const decimals = mintData.decimals;
  
  // Adjust token amount based on whether it is USDC or not
  let adjustedTokenAmount;
  if (isUSDC) {
    adjustedTokenAmount = tokenAmount;  // Use the original amount for USDC
  } else {
    // Remove decimals for non-USDC by rounding down to the nearest whole number
    adjustedTokenAmount = Math.floor(tokenAmount);
  }

  // Calculate the smallest unit of the token
  const amount = new BigNumber(adjustedTokenAmount);
  const factor = new BigNumber(10).pow(decimals);
  return amount.times(factor).integerValue(BigNumber.ROUND_DOWN).toString();
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

async function waitForSellTransactionConfirmation(signature: TransactionSignature, connection: Connection, wallet: Keypair): Promise<number> {
  console.log(`Waiting for USDC confirmation for signature: ${signature}`);
  let usdcAmountChange = 0;
  const delayTime = 10000;
  const maxDelay = 30000;
  const timeout = 120000;
  const startTime = Date.now();
  const apiKey = "9ba9abe4-5382-46d3-9c67-680bd831ea14";
  const url = `https://api.helius.xyz/v0/transactions/?api-key=${apiKey}`;

  while (true) {
    if (Date.now() - startTime > timeout) {
      console.log(`Transaction confirmation for ${signature} has timed out.`);
      return 0;
    }

    try {
      await delay(5000);
      const apiResponse = await axios.post(url, { transactions: [signature] }, { headers: { "Content-Type": "application/json" } });
      const apiData = apiResponse.data;

      if (apiData.length > 0) {
        const transactionDetails = apiData[0];
        console.log("DEBUG: Transaction details received:", transactionDetails);

        if (transactionDetails.transactionError === null) {
          const usdcTransfer = transactionDetails.tokenTransfers.find(
            (transfer: any) => 
              transfer.mint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" && 
              transfer.toUserAccount === wallet.publicKey.toString()
          );

          if (usdcTransfer) {
            usdcAmountChange = parseFloat(usdcTransfer.tokenAmount);
            console.log(`USDC amount change: ${usdcAmountChange}`);
            break;
          } else {
            console.log("USDC balance change not found or no change.");
          }
        } else {
          console.log("There was an error on the transaction.");
          return 0;
        }
      } else {
        console.log(`Transaction ${signature} is not confirmed yet or not found in external API, checking again in ${delayTime / 1000} seconds...`);
      }
    } catch (error) {
      console.error("An error occurred while fetching transaction details:", error);
      return 0;
    }

    await new Promise((resolve) => setTimeout(resolve, delayTime));
  }

  console.log(`DEBUG: Sell transaction confirmation loop ended. USDC amount received: ${usdcAmountChange}`);
  return usdcAmountChange;
}

async function pre_and_post_sell_operations(token_amount: number, token_address: String, symbol: String, message: String) {
  try {

    const secretKey = process.env.SECRET_KEY ? JSON.parse(process.env.SECRET_KEY) : null;
    const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

    console.log("INFO: Performing swap from " + token_amount + " " + token_address + " to SOL ...");
    const signature = await swap_from_token_to_sol(token_amount, token_address, wallet);
    console.log("Swap signature:", signature);

    if (!signature) {
      console.error("No signature returned from swap operation.");
      return false;
    } else {
      console.log("Swap transaction was sent. Signature:", signature);
    }

    const usdc_received = await waitForSellTransactionConfirmation(signature, connection, wallet);
    const now = new Date();
    const isoDate = now.toISOString();
    const datePart = isoDate.slice(0, 10);
    const timePart = isoDate.slice(11, 19);
    const currentDateTime = format(new Date(datePart + " " + timePart), "dd-MM-yyyy HH:mm:ss");

    if (!usdc_received) {
      console.log("No tokens received or transaction is not confirmed");
      return false;
    }

    const data: TokenToSell[] = [
      {
        date_time: currentDateTime,
        address: token_address,
        symbol: symbol,
        token_amount_sold: token_amount,
        profit_in_usd: usdc_received,
        message: message,
      },
    ];

    update_sell_tracker_after_sell(data);
    console.log(`\nSucessfull SELL: ${token_amount} of ${symbol}-${token_address}; Received $${usdc_received} USDC`);
    return signature;
  } catch (error) {
    console.error("Error during swap operation:", error);
  }
}

async function pre_and_post_sell_operations_v2(token_amount: number, token_address: string, symbol: string, message: string, db: Db) {
  try {
      
      const secretKey = process.env.SECRET_KEY ? JSON.parse(process.env.SECRET_KEY) : null;
      const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

      console.log(`INFO: Performing swap from ${token_amount} ${token_address} to SOL...`);
      // Assume swap_from_token_to_sol returns a signature or null
      const signature = await swap_from_token_to_sol(token_amount, token_address, wallet);

      if (!signature) {
          console.error("No signature returned from swap operation.");
          return false;
      }

      console.log(`Swap transaction was sent. Signature: ${signature}`);
      const usdc_received = await waitForSellTransactionConfirmation(signature, connection, wallet);

      const now = new Date();
      const isoDate = now.toISOString();
      const datePart = isoDate.slice(0, 10);
      const timePart = isoDate.slice(11, 19);
      const currentDateTime = format(new Date(datePart + " " + timePart), "dd-MM-yyyy HH:mm:ss");

      if (!usdc_received) {
          console.log("No tokens received or transaction is not confirmed");
          return false;
      }

      const data = {
          address: token_address,
          token_amount_sold: token_amount,
          profit_in_usd: usdc_received,
          message: message,
      };

      console.log("About to call process_sell()");
      await process_sell(data, db);
      console.log(`Successful SELL: ${token_amount} of ${symbol}-${token_address}; Received $${usdc_received} USDC`);
      return signature;
  } catch (error) {
      console.error("Error during swap operation:", error);
  }
}

async function pre_and_post_buy_operations_v2(amount_usd: number, token_address: String, symbol: String, db: Db) {
  try {

    const secretKey = process.env.SECRET_KEY ? JSON.parse(process.env.SECRET_KEY) : null;
    const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  
    console.log(`INFO: Attempting to perform swap from ${amount_usd} USDT ($${amount_usd} USD) to token address ${token_address}...`);
    const signature = await swap_from_usdc_to_token(amount_usd, token_address.toString(), wallet);

    const newId = new ObjectId();
    const now = new Date();
    const isoDate = now.toISOString();
    const datePart = isoDate.slice(0, 10);
    const timePart = isoDate.slice(11, 19);
    const currentDateTime = format(new Date(datePart + " " + timePart), "dd-MM-yyyy HH:mm:ss");

    const mongo_buy: mongoDB_buy = {
      _id: newId,
      tx_date: currentDateTime,
      tx_state: "pending",
      address: token_address,
      signature: signature,
      symbol: symbol,
      entry_price: 0,
      usd_spent: 0,
      token_amount_received: 0,
    };

    console.log("DEBUG: About to insert buy into MongoDB!");
    insertDocument(mongo_buy, db);
  } catch (error) {
    console.error("Error during pre and post buy operations:", error);
  }
}

async function pre_and_post_buy_operations_for_buy_manual(amount_usd: number, token_address: string) {
  try {
    const secretKey = process.env.SECRET_KEY ? JSON.parse(process.env.SECRET_KEY) : null;
    const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

    await connectToDatabase();
    const db = getDatabase("sniperbot");
    console.log(`INFO: Attempting to perform swap from ${amount_usd} USDT ($${amount_usd} USD) to token address ${token_address}...`);
    const signature = await swap_from_usdc_to_token(amount_usd, token_address, wallet);

    console.log("DEBUG: About to insert buy into MongoDB!");
    
  } catch (error) {
    console.error("Error during pre and post buy operations:", error);
  }
}

async function sendSol(receiverAddress: string, amountSol: number, wallet: Keypair): Promise<string> {
  const receiver = new PublicKey(receiverAddress);
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: receiver,
      lamports: amountSol * LAMPORTS_PER_SOL,
    })
  );

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [wallet], { commitment: "confirmed" });
    console.log(`Transaction successful with signature: ${signature}`);
    return signature;
  } catch (error) {
    console.error("Transaction failed:", error);
    throw error;
  }
}


export async function pre_and_post_buy_operations_for_ACTIVATED_wallets(amount_usd: number, token_address: string, wallet: Keypair, telegramId: string) {
  try {
      await connectToDatabase();
      const db = getDatabase("sniperbot-tg");

      console.log(`INFO: Attempting to perform swap from ${amount_usd} USDT ($${amount_usd} USD) to token address ${token_address}...`);

     
      
      
      const signature = await swap_from_usdc_to_token_for_specific_wallet(amount_usd, token_address, wallet);

      if (!signature) {
          console.error("No signature returned from swap operation.");
          return false;
      } else {
          console.log("Swap transaction was sent. Signature:", signature);
      }

      subscribeToBuySignature(signature, amount_usd, token_address, wallet, telegramId);

      

  } catch (error) {
      console.error("Error during pre and post buy operations:", error);
  }
}

async function swap_from_usdc_to_token_for_specific_wallet(amount_usd: number, token_address: string, wallet: Keypair) {
  const amountUSDtoBUY = await getAmountInSmallestUnit_v2(amount_usd, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  const tokenMint = new PublicKey(token_address);
  const url = "https://quote-api.jup.ag/v6/quote";
  const params = {
      inputMint: usdcMint.toString(),
      outputMint: tokenMint.toString(),
      amount: amountUSDtoBUY,
      slippageBps: maxSlippage.toString(),
      platformFeeBps: platform_fee_bps
  };

  try {
      const quote = await axios.get(url, { params });
      const quoteResponse = quote.data;
      console.log(`DEBUG: Received swap quote: ${JSON.stringify(quoteResponse, null, 2)}`);
      const signature = await swap_v2(quoteResponse, usdcMint, tokenMint, wallet);
      console.log("Swap from token to SOL successful with signature:", signature);
      return signature;
  } catch (error) {
      console.error("Error during swap process:", error);
      throw error;
  }
}

async function swap_for_specific_wallet(quoteResponse: any, sourceMint: PublicKey, destinationMint: PublicKey, wallet: Keypair) {
  const sourceTokenAccount = await ensureAssociatedTokenAccount_v2(sourceMint, wallet.publicKey, wallet);
  console.log("SOL associated token account created:", sourceTokenAccount.toString());
  const destinationTokenAccount = await ensureAssociatedTokenAccount_v2(destinationMint, wallet.publicKey, wallet);
  console.log("Output token associated token account created:", destinationTokenAccount.toString());

  if (!quoteResponse || !quoteResponse.routePlan || quoteResponse.routePlan.length === 0) {
      throw new Error("Invalid quote response or empty route plan");
  }

  

  const payload = {
      userPublicKey: wallet.publicKey.toString(),
      wrapAndUnwrapSol: true,
      useSharedAccounts: true,
      prioritizationFeeLamports: 30000,
      asLegacyTransaction: false,
      useTokenLedger: false,
      destinationTokenAccount: destinationTokenAccount.toString(),
      dynamicComputeUnitLimit: true,
      skipUserAccountsRpcCalls: true,
      quoteResponse: quoteResponse
  };

  try {
      const response = await axios.post("https://quote-api.jup.ag/v6/swap", payload, {
          headers: { "Content-Type": "application/json", Accept: "application/json" },
      });

      if (response.data.error) {
          console.error("Error from Jupiter API:", response.data.error);
          throw new Error(`Error from Jupiter API: ${response.data.error}`);
      }

      if (!response.data.swapTransaction) {
          console.error("Swap transaction is missing in API response.");
          throw new Error("Swap transaction is missing");
      }

      const serializedTransaction = Buffer.from(response.data.swapTransaction, "base64");
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
  } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 1000;
          console.error(`Too Many Requests. Retrying after ${retryAfter}ms...`);
          await delay(retryAfter);
          return swap_for_specific_wallet(quoteResponse, sourceMint, destinationMint, wallet);
      } else if (error instanceof Error) {
          console.error("Swap failed:", error.message);
          throw error; // Ensure the error is propagated
      } else {
          console.error("Unexpected error during swap:", error);
          throw new Error("Unexpected error during swap");
      }
  }
}

export async function pre_and_post_sell_operations_for_ACTIVE_wallets(token_amount: number, token_address: string, wallet: Keypair, telegramId: string) {
  try {

      console.log("inside pre_and_post_sell_operations_for_ACTIVE_wallets")      

      await connectToDatabase();
      const db = getDatabase("sniperbot-tg");

      
     
      const signature = await swap_from_token_to_sol_for_wallet(token_amount, token_address, wallet);
      if (!signature) {
          console.error("Failed to get a valid signature, retrying...");
          return;
      }
      const usdc_received = await waitForSellTransactionConfirmation(signature, connection, wallet);
      if (usdc_received > 0) {
          console.log("\nSell Successful!")
          if (telegramId) {
              console.log("\n* Processing Tax *");
              //await incrementTaxesToPay(usdc_received * 0.01, telegramId, db);
          }
          return signature;
      }
      

      return signature;
  } catch (error) {
      console.error("Error during swap operation:", error);
      throw error;
  }
}

async function swap_from_token_to_sol_for_wallet(tokenAmount: number, tokenAddress: string, wallet: Keypair): Promise<string> {

  console.log("inside swap_from_token_to_sol_for_wallet")   

  let retries = 0;
  const maxRetries = 5;
  while (retries < maxRetries) {
      try {
          const tokenMint = new PublicKey(tokenAddress);
          const amountToSwap = await getAmountInSmallestUnit_v2(tokenAmount, tokenAddress);
          if (amountToSwap === undefined) {
              console.error("Unable to fetch token decimals for swap.");
              return "";
          }

          const url = "https://quote-api.jup.ag/v6/quote";
          const params = {
              inputMint: tokenMint.toString(),
              outputMint: usdcMint.toString(),
              amount: amountToSwap,
              slippageBps: maxSlippage.toString()
          };

          const quote = await axios.get(url, { params });
          const quoteResponse = quote.data;
          const signature = await swap_v2(quoteResponse, usdcMint, tokenMint, wallet);

          return signature || "";
      } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 429) {
              const retryAfter = Math.min(5000, (Math.pow(2, retries) * 1000)); // Cap maximum wait to 5 seconds
              console.error(`Too Many Requests. Retrying after ${retryAfter}ms...`);
              await delay(retryAfter);
              retries++;
              continue;
          }
          console.error("Error during token to SOL swap process:", error);
          return "";
      }
  }
  console.error("Max retries hit, failed to get a valid signature.");
  return "";
}


export async function send_USDC(usdc_amount: number, destination_address: string, wallet: Keypair, token_mint: string): Promise<string> {
  console.log(`Preparing to send ${usdc_amount} ${token_mint} to ${destination_address}`);

  try {
      const destinationPublicKey = new PublicKey(destination_address);
      const microUsdcAmount = usdc_amount * 1_000_000;

      if (token_mint === "So11111111111111111111111111111111111111112") {
          // SOL transfer
          console.log('Preparing SOL transfer...');
          const transaction = new Transaction().add(
              SystemProgram.transfer({
                  fromPubkey: wallet.publicKey,
                  toPubkey: destinationPublicKey,
                  lamports: microUsdcAmount // 1 SOL = 1_000_000_000 lamports
              })
          );

          console.log('Sending SOL transaction...');
          const signature = await withTimeout(120000, sendAndConfirmTransaction(connection, transaction, [wallet], {
              skipPreflight: false,
              preflightCommitment: 'confirmed',
              commitment: 'confirmed'
          }) as Promise<string>); // Cast as Promise<string> if necessary and safe to do so

          console.log(`SOL transaction successful with signature: ${signature}`);
          return signature;
      } else {
          // Token transfer
          const mint_pubkey = new PublicKey(token_mint); // USDC mint address

          console.log('Fetching sender token account...');
          const senderTokenAccount = await getOrCreateAssociatedTokenAccount(connection, wallet, mint_pubkey, wallet.publicKey);
          console.log('Fetching recipient token account...');
          const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(connection, wallet, mint_pubkey, destinationPublicKey);

          console.log('Creating token transfer instruction...');
          const transferInstruction = createTransferInstruction(senderTokenAccount.address, recipientTokenAccount.address, wallet.publicKey, microUsdcAmount, [], TOKEN_PROGRAM_ID);
          const transaction = new Transaction().add(transferInstruction);

          console.log('Sending token transaction...');
          const signature = await withTimeout(120000, sendAndConfirmTransaction(connection, transaction, [wallet], {
              skipPreflight: false,
              preflightCommitment: 'confirmed',
              commitment: 'confirmed'
          }) as Promise<string>); // Cast as Promise<string> if necessary and safe to do so

          console.log(`Token transaction successful with signature: ${signature}`);
          return signature;
      }
  } catch (error) {
      console.error('Error during transaction:', error);
      throw error;
  }
}

class TimeoutError extends Error {
  constructor(message: string) {
      super(message);
      this.name = "TimeoutError";
  }
}

function withTimeout<T>(ms: number, promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
          reject(new TimeoutError(`Promise timed out after ${ms} milliseconds`));
      }, ms);

      promise.then(
          (res) => {
              clearTimeout(timeout);
              resolve(res);
          },
          (err) => {
              clearTimeout(timeout);
              reject(err);
          }
      );
  });
}



export async function pay_taxes(usdc_amount: number, source_wallet: Keypair): Promise<string> {
  const tax_collector_wallet = "6Lizb8185tpHbCigzADBwfdKVkAb7ia7NciW2x3Wupka";
  const destinationPublicKey = new PublicKey(tax_collector_wallet);

  const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // USDC mint address

  const microUsdcAmount = Math.round(usdc_amount * 1_000_000); // Ensure the amount is an integer

  console.log("calling getOrCreateAssociatedTokenAccount for sender token accounts");
  const senderTokenAccount = await getOrCreateAssociatedTokenAccount(connection, source_wallet, usdcMint, source_wallet.publicKey);

  console.log("calling getOrCreateAssociatedTokenAccount for recipient token accounts");
  const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(connection, source_wallet, usdcMint, destinationPublicKey);

  await delay(2000);

  console.log("calling createTransferInstruction");
  const transferInstruction = createTransferInstruction(senderTokenAccount.address, recipientTokenAccount.address, source_wallet.publicKey, BigInt(microUsdcAmount), [], TOKEN_PROGRAM_ID);
  const transaction = new Transaction().add(transferInstruction);

  const signature = await withTimeout(120000, sendAndConfirmTransaction(connection, transaction, [source_wallet], {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      commitment: 'confirmed'
  }) as Promise<string>);

  console.log(`\nDEBUG: Inside pay_taxes of jupiter_Swap Script`);
  console.log(`DEBUG: Signature: ${signature}`);

  return signature;
}


async function getFeeAccount(referralAccountPubkey: PublicKey, mint: PublicKey): Promise<PublicKey> {
  const [feeAccount] = await PublicKey.findProgramAddress(
    [
      Buffer.from("referral_ata"),
      referralAccountPubkey.toBuffer(),
      mint.toBuffer()
    ],
    new PublicKey("REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3") // Jupiter Referral Program address
  );
  return feeAccount;
}



export async function pre_and_post_sell_operations_v2_emergency(token_amount: number, token_address: String, message: String, wallet: Keypair, telegramId:string) {
  try {
      
    

      console.log("INFO: Performing swap from " + token_amount + " " + token_address + " to SOL ...");
      const signature = await swap_from_token_to_sol_emergency(token_amount, token_address, wallet); // Ensure swap_from_token_to_sol is defined
      console.log("Swap signature:", signature);

      if (!signature) {
          console.error("No signature returned from swap operation.");
          return false;
      } else {
          console.log("Swap transaction was sent. Signature:", signature);
      }

      subscribeToSellSignature(signature, token_amount, token_address, message, wallet, telegramId);

      return signature;


  } catch (error) {
      console.error("Error during swap operation:", error);
  }
}


async function waitForSellTransactionConfirmation_emergency(
  signature: TransactionSignature, 
  connection: Connection
): Promise<number> {
  console.log(`Waiting for USDC confirmation for signature: ${signature}`);
  let usdcAmountChange: number = 0;
  let delay = 3000; // Starting delay of 3 seconds
  const maxDelay = 30000; // Maximum delay of 30 seconds
  const timeout = 120000; // Set timeout to 1 minute 30 seconds
  const startTime = Date.now(); // Record the start time
  const apiKey = '9ba9abe4-5382-46d3-9c67-680bd831ea14'; // Your API key
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


async function swap_from_token_to_sol_emergency(tokenAmount: number, tokenAddress: String, wallet: Keypair): Promise<string | undefined> {
  try {
      const tokenMint = new PublicKey(tokenAddress);
      const amountToSwap = await getAmountInSmallestUnit_v2(tokenAmount, tokenAddress.toString());

      if (amountToSwap === undefined) {
          console.error("Unable to fetch token decimals for swap.");
          return;
      }

      console.log("TOKEN BALANCE to be swapped: " + amountToSwap);

      const url = "https://quote-api.jup.ag/v6/quote";
      const params = {
          inputMint: tokenMint.toString(),
          outputMint: usdcMint.toString(), // Ensure this variable is defined in your scope
          amount: amountToSwap,
          slippageBps: maxSlippage // Ensure this variable is defined in your scope
      };

      console.log("Requesting quote with parameters:", params);
      const quote = await axios.get(url, { params });
      const quoteResponse = quote.data;
      
      if (!quoteResponse || quoteResponse.error) {
          console.error("Failed to get a valid quote response:", quoteResponse.error);
          return;
      }

      console.log("Received swap quote response:", JSON.stringify(quoteResponse, null, 2));

      const signature = await swap_v2_emergency(quoteResponse, tokenMint, usdcMint, wallet);
      return signature;
  } catch (error) {
      console.error("Error during token to SOL swap process:", error);
  }
}


async function ensureAssociatedTokenAccount_v2_emergency(mint: PublicKey, owner: PublicKey, wallet: Keypair): Promise<PublicKey> {
    
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

async function swap_v2_emergency(quoteResponse: any, sourceMint: PublicKey, destinationMint: PublicKey, wallet: Keypair): Promise<string | undefined> {
  try {
      const sourceTokenAccount = await ensureAssociatedTokenAccount_v2_emergency(sourceMint, wallet.publicKey, wallet);
      const destinationTokenAccount = await ensureAssociatedTokenAccount_v2_emergency(destinationMint, wallet.publicKey, wallet);

      console.log("Preparing payload for the swap transaction...");
      const payload = {
          userPublicKey: wallet.publicKey.toString(),
          wrapAndUnwrapSol: true,
          useSharedAccounts: true,
          prioritizationFeeLamports: 25000,
          asLegacyTransaction: false,
          useTokenLedger: false,
          destinationTokenAccount: destinationTokenAccount.toString(),
          dynamicComputeUnitLimit: true,
          skipUserAccountsRpcCalls: true,
          quoteResponse: quoteResponse
      };

      console.log("Sending POST request to execute swap...");
      const response = await axios.post("https://quote-api.jup.ag/v6/swap", payload, {
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
      });

      if (response.data.error) {
          console.error("Error from Jupiter API:", response.data.error);
          return;
      }

      if (!response.data.swapTransaction) {
          console.error("Swap transaction is missing in API response.");
          return;
      }

      const serializedTransaction = Buffer.from(response.data.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(serializedTransaction);
      transaction.sign([wallet]);

      console.log("Sending signed transaction to the network...");
      const signature = await connection.sendRawTransaction(transaction.serialize());
      console.log("Transaction sent, signature:", signature);

      return signature;
  } catch (error) {
      console.error("Error processing swap transaction:", error);
      throw error;
  }
}



export async function pre_and_post_buy_operations_v2_emergency(amount_usd: number, token_address: String, symbol: String, db: Db) {
  try {

    const secretKey = process.env.SECRET_KEY ? JSON.parse(process.env.SECRET_KEY) : null;
    const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  
    console.log(`INFO: Attempting to perform swap from ${amount_usd} USDT ($${amount_usd} USD) to token address ${token_address}...`);
    

    
    while (true) {
      try {
        const signature = await swap_from_usdc_to_token(amount_usd, token_address.toString(), wallet);
          if (!signature) {
              console.error("Failed to get a valid signature, retrying...");
              continue;
          }
          const { tokenAmountReceived, usdcAmountSpent, error } = await waitForTransactionConfirmation(signature, token_address.toString(), "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

          if (tokenAmountReceived > 0 && usdcAmountSpent > 0 && (!error || error === null || error === undefined || error === "")) {
              console.log("\nBuy Successful!");
              console.log("\n* Processing Tax *");
              //await incrementTaxesToPay(tokenAmountReceived * 0.01, telegramId, db);
              return { signature, tokenAmountReceived, usdcAmountSpent };
          } else {
              console.log("Retrying to buy...");
          }
      } catch (swapError) {
          console.error("Error during swap process:", swapError);
          break;
      }
  }

    
  } catch (error) {
    console.error("Error during pre and post buy operations:", error);
  }
}




function subscribeToSellSignature(signature: string, token_amount: number, token_address: String, message: String, wallet: Keypair, telegramId: string) {
  // Initialize a new WebSocket connection
  const ws = new WebSocket('wss://api.mainnet-beta.solana.com');

  ws.on('open', () => {
      console.log('WebSocket connection opened.');
      const subscribeMessage = {
          "jsonrpc": "2.0",
          "id": 1,
          "method": "signatureSubscribe",
          "params": [
              signature,  // Use the transaction signature received from the swap transaction
              { "commitment": "finalized" }
          ]
      };
      ws.send(JSON.stringify(subscribeMessage));
      console.log('Subscription request sent:', subscribeMessage);
  });

  ws.on('message', (data: string) => {
      const response = JSON.parse(data);
      console.log('Received message:', response);

      if (response.method === 'signatureNotification') {
          const result = response.params.result;
          console.log('Transaction confirmed in slot:', result.context.slot);

          fetchSellTransactionDetails(signature, token_amount, token_address, message, wallet, telegramId);
          

          // Clean up after receiving the notification
          ws.close();
      }
  });

  ws.on('close', () => {
      console.log('WebSocket connection closed.');
  });

  ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
  });
}

async function fetchSellTransactionDetails(signature: string, token_amount: number, token_address: String, message: String, wallet: Keypair, telegramId: string) {

    const usdc_received = await waitForSellTransactionConfirmation(signature, connection, wallet);

    if (!usdc_received) {
        console.log("Transaction failed, Re-doing the sell swap...");
        pre_and_post_sell_operations_v2_emergency(token_amount, token_address, message, wallet, telegramId);
    } else {
        console.log(`Transaction sucessfull for wallet ${wallet}\nSignature: ${signature}`)

        const tg_message = `New token sell!\n\nSell type: ${message}\n\nUSDC received: $${usdc_received.toFixed(2)}\n\n ${token_amount.toFixed(2)} token sold\n\nToken Address: ${token_address}\n\nTransaction signature: ${signature}`;
        await send_message_to_telegramId(tg_message, telegramId);

        console.log(`Sell operation successful for wallet ${wallet}`);
    }
}


//------------------------------------------

function subscribeToBuySignature(signature: string, amount_usd: number, token_address: string, wallet: Keypair, telegramId: string) {
  // Initialize a new WebSocket connection
  const ws = new WebSocket('wss://api.mainnet-beta.solana.com');

  ws.on('open', () => {
      console.log('WebSocket connection opened.');
      const subscribeMessage = {
          "jsonrpc": "2.0",
          "id": 1,
          "method": "signatureSubscribe",
          "params": [
              signature,  // Use the transaction signature received from the swap transaction
              { "commitment": "finalized" }
          ]
      };
      ws.send(JSON.stringify(subscribeMessage));
      console.log('Subscription request sent:', subscribeMessage);
  });

  ws.on('message', (data: string) => {
      const response = JSON.parse(data);
      console.log('Received message:', response);

      if (response.method === 'signatureNotification') {
          const result = response.params.result;
          console.log('Transaction confirmed in slot:', result.context.slot);

          fetchBuyTransactionDetails(signature, amount_usd, token_address, wallet, telegramId);
          

          // Clean up after receiving the notification
          ws.close();
      }
  });

  ws.on('close', () => {
      console.log('WebSocket connection closed.');
  });

  ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
  });
}

async function fetchBuyTransactionDetails(signature: string, amount_usd: number, token_address: string, wallet: Keypair, telegramId: string) {

  const { tokenAmountReceived, usdcAmountSpent, error } = await waitForTransactionConfirmation(signature, token_address.toString(), "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
  if (tokenAmountReceived > 0 && usdcAmountSpent > 0 && (!error || error === null || error === undefined || error === "")) {
      console.log("\nBuy Successful!");
      
      const tg_message = `New token buy!n\nUSDC spent: $${usdcAmountSpent.toFixed(2)}\n\n ${tokenAmountReceived.toFixed(2)} token bought\n\nToken Address: ${token_address}\n\nTransaction signature: ${signature}`;
      await send_message_to_telegramId(tg_message, telegramId);
      console.log(`Buy operation successful for wallet ${wallet}`);
  } else {
      console.log("Retrying to buy...");

      pre_and_post_buy_operations_for_ACTIVATED_wallets(amount_usd, token_address.toString(), wallet, telegramId);
  }
}