import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { connectToDatabase, getDatabase, findAllWallets, resetTaxesToPay } from "./mongoDB_connection";
import { pay_all_taxes } from './my_wallet'
import { Keypair } from "@solana/web3.js";
import { Db } from "mongodb";

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

async function main() {

    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");

    switch (arg1) {
        
        case "reset-all-tax":
            if (args.length >= 3) {
                const telegramId = args[1];
                await reset_tax(telegramId, db);
            } else {
                console.log("Error: Insufficient arguments for 'sell'");
            }

        case "reset-all-tax":
            await reset_all_taxes(db);
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