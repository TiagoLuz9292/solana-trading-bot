export { swap_from_sol_to_token, swap_from_token_to_sol};
import { getAllBalances, getTokenBalance } from './my_wallet';
import { Keypair, Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const solanaEndpoint = "https://api.mainnet-beta.solana.com";
const secretKey = process.env.SECRET_KEY ? JSON.parse(process.env.SECRET_KEY) : null;
const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

console.log(`Wallet: ${wallet.publicKey.toBase58()}`)

const connection = new Connection(solanaEndpoint, 'confirmed');

const solMint = new PublicKey("So11111111111111111111111111111111111111112");
const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

async function ensureAssociatedTokenAccount(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
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
            prioritizationFeeLamports: 5000,
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


async function swap_from_sol_to_token(amount_sol : number, token_Address : String) {

    const amount_sol_to_buy = getAmountInSmallestUnit(amount_sol, "So11111111111111111111111111111111111111112")
    
    const tokenMint = new PublicKey(token_Address)

    const url = "https://quote-api.jup.ag/v6/quote";
    const params = {
        inputMint: solMint.toString(),
        outputMint: tokenMint.toString(),
        amount: '253652'  // use the amount_usdc parameter for the amount
    };

    try {
        const quote = await axios.get(url, { params });
        const quoteResponse = quote.data;
        console.log("DEBUG: PRINTING QUOTE RESPONSE");
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

async function swap_from_token_to_sol(tokenAmount: number, tokenAddress: string) {
    try {
        const tokenMint = new PublicKey(tokenAddress);
        const solMint = new PublicKey("So11111111111111111111111111111111111111112"); // This is the public key for SOL

        // Convert tokenAmount to the smallest unit using the getAmountInSmallestUnit function
        const amountToSwap = await getAmountInSmallestUnit(tokenAmount, tokenAddress);

        const url = "https://quote-api.jup.ag/v6/quote";
        const params = {
            inputMint: tokenMint.toString(),
            outputMint: solMint.toString(),
            amount: amountToSwap.toString()  // Now amountToSwap should be in the correct smallest unit
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
    } catch (error) {
        console.error("Error during token to SOL swap process:", error);
    }
}

async function swap_tokens(
    inputTokenAmount: number,
    inputTokenAddress: string,
    outputTokenAddress: string
  ) {
    try {
      const inputTokenMint = new PublicKey(inputTokenAddress);
      const outputTokenMint = new PublicKey(outputTokenAddress);
  
      // Getting a quote for the token swap
      const url = "https://quote-api.jup.ag/v6/quote";
      const params = {
        inputMint: inputTokenMint.toString(),
        outputMint: outputTokenMint.toString(),
        amount: inputTokenAmount.toString(), // Convert the amount to a string
      };
  
      const quoteResponse = await axios.get(url, { params }).then((res) => res.data);
  
      console.log("Quote response:", JSON.stringify(quoteResponse, null, 2));
  
      // Initiating the swap with the quote response
      const swapResponse = await swap(quoteResponse, inputTokenMint, outputTokenMint);
  
      if (!swapResponse || !swapResponse.swapTransaction) {
        console.error("Swap failed or swap transaction is missing");
        return;
      }
  
      // Deserialize, sign, and send the transaction
      const serializedTransaction = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(serializedTransaction);
      transaction.sign([wallet]); // Sign the transaction with your wallet
  
      // Sending the transaction
      const signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: true, // Assume Jupiter has already pre-checked the transaction
      });
  
      console.log("Token swap successful with signature:", signature);
    } catch (error) {
      console.error("Error during token-to-token swap process:", error);
    }
}

async function get_quote_for_swap_from_sol_to_token(tokenAmount: number, tokenAddress: string){

    try {
        const tokenMint = new PublicKey(tokenAddress);
        const solMint = new PublicKey("So11111111111111111111111111111111111111112"); // This is the public key for SOL

        // Constructing the URL and parameters for the quote API call
        const url = "https://quote-api.jup.ag/v6/quote";
        const params = {
            inputMint: solMint.toString(),
            outputMint: tokenMint.toString(),
            amount: '2480' // Make sure to convert the amount to a string
        };

        // Get the quote from the Jupiter API
        console.log("DEBUG: REQUESTING QUOTE RESPONSE FROM SOL TO TOKEN");
        const quote = await axios.get(url, { params });
    
        const quoteResponse = quote.data;
        console.log("DEBUG: PRINTING QUOTE RESPONSE FROM SOL TO TOKEN");
        console.log(JSON.stringify(quoteResponse, null, 2));
    } catch (error) {
        console.error("Error during token-to-token swap process:", error);
      }
}

async function get_quote_for_swap_from_token_to_sol(tokenAmount: number, tokenAddress: string) {
    try {
        const tokenMint = new PublicKey(tokenAddress);
        const solMint = new PublicKey("So11111111111111111111111111111111111111112"); // This is the public key for SOL

        // Convert token amount to the smallest unit based on its decimals
        const amountToSwap = await getAmountInSmallestUnit(tokenAmount, tokenAddress);

        const url = "https://quote-api.jup.ag/v6/quote";
        const params = {
            inputMint: tokenMint.toString(),
            outputMint: solMint.toString(),
            amount: amountToSwap.toString()
        };

        const quote = await axios.get(url, { params });
        const quoteResponse = quote.data;

        console.log("DEBUG: PRINTING QUOTE RESPONSE FROM TOKEN TO SOL");
        console.log(JSON.stringify(quoteResponse, null, 2));
    } catch (error) {
        console.error("Error during token-to-token swap process:", error);
    }
}

async function getAmountInSmallestUnit(tokenAmount: number, tokenAddress: string): Promise<number> {
    const tokenMint = new PublicKey(tokenAddress);
    const tokenInfo = await connection.getParsedAccountInfo(tokenMint);

    if (tokenInfo.value?.data) {
        const tokenData = tokenInfo.value.data;
        if ("parsed" in tokenData && tokenData.parsed.info && tokenData.parsed.info.decimals) {
            const decimals = tokenData.parsed.info.decimals;
            return tokenAmount * Math.pow(10, decimals);
        } else {
            throw new Error("Token data does not have parsed information.");
        }
    } else {
        throw new Error("Could not fetch token information");
    }
}
//swap_tokens(1000000, "EWnBehhDnuJ7TAJuqdyxFMXryi8VYCgkZjDRqb9ja7MC", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
//swap_from_token_to_sol(15458, "EWnBehhDnuJ7TAJuqdyxFMXryi8VYCgkZjDRqb9ja7MC");
//swap_from_sol_to_token(253652 ,'5M6kZ95iH2LPoHrGT358e45ygHAmtYKDKAe9gi1JbkxT')
// 1000000 = 1$ 0,049682012
//get_quote_for_swap_from_sol_to_token(2480, "5M6kZ95iH2LPoHrGT358e45ygHAmtYKDKAe9gi1JbkxT")
//get_quote_for_swap_from_token_to_sol(2480, "5M6kZ95iH2LPoHrGT358e45ygHAmtYKDKAe9gi1JbkxT")
