import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { connectToDatabase, getDatabase, findAllWallets, resetTaxesToPay, findWalletByTelegramId } from "./mongoDB_connection";
import { get_wallet_balances_in_usd_v2, pay_all_taxes } from './my_wallet'
import { Keypair } from "@solana/web3.js";
import { Db } from "mongodb";
import dotenv from "dotenv";


dotenv.config({ path: '/root/project/solana-trading-bot/jupiter-trading-bot/.env' });

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

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

async function receive_taxes(db: Db) {
    

    let allTaxesPaid = false;

    while (!allTaxesPaid) {
        allTaxesPaid = true;
        const existingWallets = await findAllWallets(db);

        for (const existingWallet of existingWallets) {
            if (existingWallet.taxes_to_pay === 0) {
                console.log("\nThis wallet has 0 taxes to pay, skipping.\n")
                continue; // Skip this iteration if taxes_to_pay is 0
            }

            try {
                const decryptedSecretKey = decryptText(existingWallet.secretKey);
                const secretKeyArray = JSON.parse(decryptedSecretKey);
                const wallet = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));

                console.log("\nCalling pay_all_taxes() from mywallet script\n")
                const signature = await pay_all_taxes(existingWallet.taxes_to_pay, wallet);

                if (signature) {
                    console.log(`\nTransaction successful with signature: ${signature}\n`)
                    console.log(`\nResetting tax to pay for this wallet.\n`)
                    await resetTaxesToPay(existingWallet.telegramId, db);
                } else {
                    allTaxesPaid = false;
                }
            } catch (error) {
                console.error(`Failed to process wallet with telegramId: ${existingWallet.telegramId}. Error: ${error}`);
                allTaxesPaid = false;
                await delay(1000); // Delay to prevent rapid retries in case of an error
            }
        }

        if (!allTaxesPaid) {
            await delay(5000); // Delay before retrying if not all taxes are paid
        }
    }
}


async function reset_all_taxes(db: Db) {

    const existingWallets = await findAllWallets(db);

    for (const existingWallet of existingWallets) { 
        await resetTaxesToPay(existingWallet.telegramId, db);
    }

}

async function reset_tax(telegramId: string, db: Db) {

        await resetTaxesToPay(telegramId, db);
    
}





const args = process.argv.slice(2);

if (args.length < 1) {
    console.log("Usage: ts-node script_name.ts case_number [optional_arguments]");
    process.exit(1);
}

const arg1 = args[0];


async function get_all_balances(telegramId: string, db: Db) {
   

    console.log("Inside get balances");
    // Fetch the user's wallet
    const existingWallet = await findWalletByTelegramId(telegramId, db);
    if (existingWallet) {
        console.log(`record exists for telegramId ${telegramId}`);
        const decryptedSecretKey = decryptText(existingWallet.secretKey);
        
        let wallet;
        try {
            const secretKeyArray = JSON.parse(decryptedSecretKey); // Parse JSON string to array
            wallet = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
        } catch (parseError) {
            console.error('Error parsing decrypted secret key:', parseError);
            return;
        }
        
        // Get wallet balances in USD

        console.log("Getting ballances");
        const balances = await get_wallet_balances_in_usd_v2(wallet);

        

        const taxesToPay = existingWallet.taxes_to_pay || 0; // Fetch taxes to pay from the wallet record, assume 0 if not set

        // No need to parse as number if already a number
        const USDCValue = balances.USDC_value; // Already a number

        
        const totalUSDInvested = typeof balances.totalUSDInvested === 'string' ? parseFloat(balances.totalUSDInvested) : balances.totalUSDInvested;

        const adjustedUSDCValue = USDCValue - taxesToPay;
        const adjustedTotalUSDInvested = totalUSDInvested - taxesToPay;

        const message = `
    wallet: ${wallet}

    SOL Balance: ${balances.sol_balance.toFixed(6)}
    SOL Value in USD: $${balances.sol_value_in_USD.toFixed(2)}
    USDC Value: $${adjustedUSDCValue.toFixed(2)}
    Tokens Value in USD: $${balances.tokens_USD_value.toFixed(2)}
    Account Total in USD: $${adjustedTotalUSDInvested.toFixed(2)}
    
            `;
    
        console.log(message);
    }
    
}    

async function main() {

    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");

    switch (arg1) {


        case "get-balances":
            if (args.length >= 2) {
                const telegramId = args[1];

                console.log(`telegramId = ${telegramId}`);

                await get_all_balances(telegramId, db);
                
            }    
            break;  

        case "reset-tax":
            if (args.length >= 3) {
                const telegramId = args[1];
                await reset_tax(telegramId, db);
            } else {
                console.log("Error: Insufficient arguments for 'sell'");
            }
            break;  
        case "reset-all-tax":
            //await reset_all_taxes(db);
            break;    

        case "receive-tax":
            await receive_taxes(db);
            break;    
        
        default:
            console.log("BUY-BOT: Invalid command. Please provide one of the following inputs: \n\n-> buy\n-> buy-from-filtered\n-> sol-amount\n-> sell\n-> sell-all");
            process.exit(1);
    }
}

main().catch(error => {
    console.error("Failed to run main function:", error);
    process.exit(1);
});