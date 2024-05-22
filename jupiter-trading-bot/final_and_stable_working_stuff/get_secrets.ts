import { Telegraf, Markup, Context, Scenes, Composer, NarrowedContext  } from 'telegraf';
import { Message, Update } from 'telegraf/typings/core/types/typegram';
import { Keypair } from '@solana/web3.js';
import dotenv from "dotenv";
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { insertWalletData, findWalletByTelegramId, activateWallet, deactivateWallet, getWalletActivationStatus, checkTelegramIdExists, connectToDatabase, getDatabase, updateUserRecord, resetTaxesToPay } from "./mongoDB_connection"; // Ensure the functions are correctly implemented
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { get_wallet_balances_in_usd, get_wallet_balances_in_usd_v2} from './my_wallet';
import { withdraw_USDC, pay_all_taxes, convert_USDT_to_USDC, convert_SOL_to_USDC, sell_token } from './my_wallet';
import { sell_all } from './transaction_manager';
import { Db } from 'mongodb';
import session from 'telegraf/session';
import axios from 'axios';



dotenv.config({ path: '/root/project/solana-trading-bot/jupiter-trading-bot/.env' });

const bot = new Telegraf(process.env.Solana_Sniper_Club_bot_TOKEN!);

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


async function get_secret() {
    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");

    const telegramId = "2088746736";
    // Fetch the user's wallet
    const existingWallet = await findWalletByTelegramId(telegramId, db);
    if (existingWallet) {
        const decryptedSecretKey = decryptText(existingWallet.secretKey);

        let wallet;
        try {
            const secretKeyArray = JSON.parse(decryptedSecretKey); // Parse JSON string to array
            console.log(secretKeyArray);
            wallet = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
        } catch (parseError) {
            console.error('Error parsing decrypted secret key:', parseError);
            return;
        }
    }
}     

get_secret();