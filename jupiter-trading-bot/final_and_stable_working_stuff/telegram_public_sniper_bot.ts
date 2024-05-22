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


const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, 'bot_actions.log');


function logAction(userId: number, username: string, action: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] User: ${username} (ID: ${userId}) clicked ${action}\n`;
    console.log("************************");
    console.log(logMessage);
    console.log("************************");
    fs.appendFile(logFilePath, logMessage, (err: NodeJS.ErrnoException | null) => {
        if (err) {
            console.error('Error logging action:', err);
        }
    });
}

// In-memory cache for cooldowns
const cooldowns = new Map<string, number>();

const SHARED_COOLDOWN_TIME = 4000;



// Helper function to check cooldown
function isOnCooldown(telegramId: string, command: string, cooldownTime: number, sharedCooldown = false): boolean {
    const currentTime = Date.now();
    const sharedKey = `${telegramId}:shared`;
    const specificKey = `${telegramId}:${command}`;

    const sharedExpirationTime = cooldowns.get(sharedKey);
    const specificExpirationTime = cooldowns.get(specificKey);

    if (sharedCooldown && sharedExpirationTime && currentTime < sharedExpirationTime) {
        return true;
    }

    if (!sharedCooldown && specificExpirationTime && currentTime < specificExpirationTime) {
        return true;
    }

    if (sharedCooldown) {
        cooldowns.set(sharedKey, currentTime + cooldownTime);
    } else {
        cooldowns.set(specificKey, currentTime + cooldownTime);
    }

    return false;
}



bot.start(async (ctx) => {
    
    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");

    const telegramId = ctx.from.id.toString();
  
    // Check if the Telegram ID exists in the access list
    const isAuthorized = await checkTelegramIdExists(parseInt(telegramId), db);
    if (!isAuthorized) {
      const message = `Welcome to Solana Sniper Club BOT!\nIf you want to use this bot, please DM @Furymuse to ask for access.\nYour Telegram ID is: ${telegramId}`;
      ctx.reply(message);
      return;
    }
  
    // Check if the user already has a wallet
    const existingWallet = await findWalletByTelegramId(telegramId, db);
    if (existingWallet) {
      const message = `Welcome back to Solana Sniper Club BOT!\n\nHere is your wallet address: ${existingWallet.walletAddress}`;
      display_menu(message, telegramId, ctx, db);
    } else {
      try {
        const wallet = Keypair.generate();
        const walletAddress = wallet.publicKey.toString();
        const secretKeyArray = Array.from(wallet.secretKey); // Convert Uint8Array to array
        const secretKey = JSON.stringify(secretKeyArray); // Convert array to JSON string for storage
        const encryptedSecretKey = encryptText(secretKey);
  
        if (!encryptedSecretKey) {
          throw new Error("Failed to encrypt secret key.");
        }
  
        // Insert new wallet data into MongoDB
        await insertWalletData(telegramId, walletAddress, encryptedSecretKey, db);
        const message = `Welcome to Solana Sniper Club BOT!\n\nWe have just prepared your new wallet, make sure you deposit some SOL for fees, and USDC, which will be the currency used for the trades.\n\nHere is your new Solana wallet address: ${walletAddress}`;
        display_menu(message, telegramId, ctx, db);
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Error creating wallet:', error.message);
        } else {
          console.error('Error creating wallet: An unexpected error occurred');
        }
        ctx.reply('Failed to create a new wallet. Please try again later.');
      }
    }
  });

bot.command('menu', async (ctx) => {
    
    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");

    const telegramId = ctx.from.id.toString();

    // Check if the user already has a wallet
    const existingWallet = await findWalletByTelegramId(telegramId, db);
    if (existingWallet) {
        const message = `Welcome back to Solana Sniper Club BOT!\n\nHere is your wallet address: ${existingWallet.walletAddress}`;
        display_menu(message, telegramId, ctx, db);
    } else {
        ctx.reply("You do not have a wallet yet. Please use /start to create one.");
    }
});

async function display_menu(message: string, telegramId: string, ctx: { reply: (arg0: string, arg1: Markup.Markup<InlineKeyboardMarkup>) => void; }, db: Db) {
    // Get the activation status of the wallet
    const activationStatus = await getWalletActivationStatus(telegramId, db);

    // Determine the button text and callback action based on the activation status
    const buttonText = activationStatus ? 'Deactivate' : 'Activate';
    const callbackAction = activationStatus ? 'DEACTIVATE' : 'ACTIVATE';

    ctx.reply(message, 
        Markup.inlineKeyboard([
            [Markup.button.callback('Balance', 'balance'), Markup.button.callback('Sell-All', 'SELLALL'), Markup.button.callback('Withdraw', 'WITHDRAW')],
            [Markup.button.callback('usdT -> usdC', 'USDT_TO_USDC'), Markup.button.callback('SOL -> usdC', 'SOL_TO_USDC')],
            [Markup.button.callback('Settings', 'SETTINGS'), Markup.button.callback('Bot Guide', 'botguide'), Markup.button.callback('FAQ', 'faq')],
            [Markup.button.callback(buttonText, callbackAction)]
        ])
    );
}





bot.action('SOL_TO_USDC', async (ctx) => {

    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'SOL_TO_USDC');

    if (isOnCooldown(telegramId.toString(), 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
        ctx.reply('Please wait a few seconds before using another button.');
        return;
    }

    if (isOnCooldown(telegramId, 'SOL_TO_USDC', 3 * 60 * 1000)) {
        ctx.reply('You need to wait 3 minutes before using this command again.');
        return;
    }

    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");
    
    const existingWallet = await findWalletByTelegramId(telegramId, db);

    if (existingWallet) {
        // Decrypt the wallet's secret key and instantiate the wallet object
        const decryptedSecretKey = decryptText(existingWallet.secretKey);
        const secretKeyArray = JSON.parse(decryptedSecretKey);
        const wallet = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));

        const balances = await get_wallet_balances_in_usd(wallet);
        const sol_balance = balances.sol_balance;
        const sol_to_convert = sol_balance - 0.03;


        if (sol_to_convert > 0 ) {
            ctx.reply('Converting SOL to usdC...');
            const signature = await convert_SOL_to_USDC(sol_to_convert, wallet);
            if (signature) {
                ctx.reply(`Successfully converted USDT to USDC.\n\nSignature:\n${signature}`);
            }


        } else {
            ctx.reply('You need at least 0.025 SOL on the wallet for trades.');
            return;
        }
         

    } else {
        ctx.reply("You do not have a wallet yet. Please use /start to create one.");
    }
});

bot.action('USDT_TO_USDC', async (ctx) => {

    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'USDT_TO_USDC');

    if (isOnCooldown(telegramId, 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
        ctx.reply('Please wait a few seconds before using another button.');
        return;
    }

    if (isOnCooldown(telegramId, 'USDT_TO_USDC', 3 * 60 * 1000)) {
        ctx.reply('You need to wait 3 minutes before using this command again.');
        return;
    }

    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");
    
    const existingWallet = await findWalletByTelegramId(telegramId, db);

    if (existingWallet) {
        // Decrypt the wallet's secret key and instantiate the wallet object
        const decryptedSecretKey = decryptText(existingWallet.secretKey);
        const secretKeyArray = JSON.parse(decryptedSecretKey);
        const wallet = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));

        const balances = await get_wallet_balances_in_usd(wallet);
        const usdt_value = balances.USDT_value;

        if (usdt_value > 0) {
            ctx.reply('Converting usdT to usdC...');
            const signature = await convert_USDT_to_USDC(balances.USDT_value, wallet); 

            if (signature) {
                ctx.reply(`Successfully converted USDT to USDC.\n\nSignature:\n${signature}`);
            }
        } else {
            ctx.reply('This wallet doesnt hold USDT.');
            return;
        }
         

    } else {
        ctx.reply("You do not have a wallet yet. Please use /start to create one.");
    }
});

bot.action('faq', (ctx) => {

    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'FAQ');

    if (isOnCooldown(telegramId.toString(), 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
        ctx.reply('Please wait a few seconds before using another button.');
        return;
    }
    ctx.reply(`
    ❓ What do I need for the bot to make trades on my wallet?
    
    ✅ Minimum:
        0.025 SOL
        $50 USDC
       Then Click "ACTIVATE" Button and you are redy to go 🔥
    
    ❓ What if I transferred USDT instead of USDC?
    
    ✅ There is a button to convert from USDT to USDC
    
    ❓ Can I transfer Solana and convert it to USDC?
    
    ✅ Yes, there is a button to convert the majority of SOL into USDC; it will leave just enough for the trade fees
    
    ❓ What if my SOL balance goes to 0 while the bot is making trades with my wallet?
    
    ✅ The bot will automatically buy a small amount of SOL if its balance goes below 0.015

    `);
});

bot.action('botguide', (ctx) => {

    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'BOT_GUIDE');

    if (isOnCooldown(telegramId.toString(), 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
        ctx.reply('Please wait a few seconds before using another button.');
        return;
    }
    ctx.reply(`
🟢Sell-All ->  I will initiate an operation that will Sell a percentage of ALL the tokens in your wallet (Except SOL).
    
🟢Activate ->  Make your wallet Active. While it's active, the bot will take it into consideration when replicating the Buys and Sells.
    
🟢Settings ->  
        Trade Value: The percentage of the total value of your wallet in USD that will be invested in each trade;
        Amount to Sell on TP1: The percentage of the token holdings to be sold at Take Profit 1;
        Amount to Sell on TP2: The percentage of the token holdings to be sold at Take Profit 2;
    
🟢Withdraw ->  Currently you can only withdraw USDC, select a valid amount, and a valid Solana wallet. In the future, you will be able to withdraw SOL.
    `);
});



bot.action('SETTINGS', async (ctx) => {

    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'SETTINGS');

    if (isOnCooldown((ctx.from.id).toString(), 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
        ctx.reply('Please wait a few seconds before using another button.');
        return;
    }
    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");  // Use the appropriate database name

    try {
        const userSettings = await db.collection('tg_info').findOne({ telegramId: telegramId });
        if (!userSettings) {
            ctx.reply("No settings found. Please configure your settings.");
            return;
        }

        const tradeValue = (userSettings.account_percent_to_invest * 100).toFixed(2);  // Assuming it's stored as a decimal, formatted to 0 decimal places
        const tp1Amount = (userSettings.take_profit_1_amount * 100).toFixed(0);
        const tp2Amount = (userSettings.take_profit_2_amount * 100).toFixed(0);

        ctx.reply("Your current settings:",
            Markup.inlineKeyboard([
                [Markup.button.callback(`Trade Value: ${tradeValue}%`, 'EDIT_TRADE_VALUE')],
                [Markup.button.callback(`Amount to Sell on TP 1: ${tp1Amount}%`, 'EDIT_TP1_AMOUNT')],
                [Markup.button.callback(`Amount to Sell on TP 2: ${tp2Amount}%`, 'EDIT_TP2_AMOUNT')]
            ])
        );
    } catch (error) {
        console.error("Error fetching settings:", error);
        ctx.reply("Failed to retrieve settings. Please try again later.");
    }
});

const userState = new Map();

bot.action('EDIT_TRADE_VALUE', async (ctx) => {
    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'EDIT_TRADE_VALUE');

    ctx.reply("Please enter the new trade value percentage (0.5% to 5%):");
    userState.set(ctx.from.id, { action: 'update', field: 'account_percent_to_invest' });
});

bot.action('EDIT_TP1_AMOUNT', async (ctx) => {
    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'EDIT_TP1_AMOUNT');

    if (isOnCooldown(telegramId, 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
        ctx.reply('Please wait a few seconds before using another button.');
        return;
    }
    ctx.reply("Please enter the new percentage for Take Profit 1 (1% to 100%):");
    userState.set(ctx.from.id, { action: 'update', field: 'take_profit_1_amount' });
});

bot.action('EDIT_TP2_AMOUNT', async (ctx) => {
    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'EDIT_TP2_AMOUNT');

    if (isOnCooldown(telegramId, 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
        ctx.reply('Please wait a few seconds before using another button.');
        return;
    }
    ctx.reply("Please enter the new percentage for Take Profit 2 (1% to 100%):");
    userState.set(ctx.from.id, { action: 'update', field: 'take_profit_2_amount' });
});

bot.action('WITHDRAW', async (ctx) => {
    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'WITHDRAW');

    if (isOnCooldown(telegramId, 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
        ctx.reply('Please wait a few seconds before using another button.');
        return;
    }

    ctx.reply("Do you want to withdraw SOL or USDC?");
    userState.set(ctx.from.id, { action: 'withdraw', step: 'currency' });
});



bot.on('text', async (ctx) => {
    const state = userState.get(ctx.from.id);
    if (!state || !state.action) {
        return;  // Ignore if there's no action set
    }

    const inputValue = ctx.message.text.trim();


    if (state.action === 'withdraw') {
        if (state.step === 'currency') {
            if (inputValue.toUpperCase() === 'SOL' || inputValue.toUpperCase() === 'USDC') {
                userState.set(ctx.from.id, { action: 'withdraw', step: 'amount', currency: inputValue.toUpperCase() });
                ctx.reply("Insert amount:");
            } else {
                ctx.reply("Invalid input. Please enter either 'SOL' or 'USDC'.");
            }
            return;
        }

        if (state.step === 'amount') {
            const amount = parseFloat(inputValue);
            if (isNaN(amount) || amount <= 0) {
                ctx.reply("Invalid amount. Please enter a valid number.");
            } else {
                userState.set(ctx.from.id, { action: 'withdraw', step: 'walletAddress', currency: state.currency, amount });
                ctx.reply("Insert destination wallet address:");
            }
            return;
        }

        if (state.step === 'walletAddress') {
            const walletAddress = inputValue;
            if (!walletAddress) {
                ctx.reply("Invalid wallet address. Please enter a valid wallet address.");
            } else {
                ctx.reply(`You have chosen to withdraw ${state.amount} ${state.currency} to the wallet address: ${walletAddress}`);
                try {
                    await connectToDatabase();
                    const db = getDatabase("sniperbot-tg");
                    const telegramId = ctx.from.id.toString();
                    const existingWallet = await findWalletByTelegramId(telegramId, db);
                    if (existingWallet) {
                        const decryptedSecretKey = decryptText(existingWallet.secretKey);
                        const secretKeyArray = JSON.parse(decryptedSecretKey); // Parse JSON string to array
                        const wallet = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
                        const signature = await withdraw_USDC(state.amount, walletAddress, wallet, state.currency);
                        ctx.reply(`Transfer successful with signature ${signature}`);
                        userState.delete(ctx.from.id); // Clear the user state
                    }
                } catch (error) {
                    console.error('Error during withdrawal process:', error);
                    ctx.reply('An error occurred during the withdrawal process. Please try again later.');
                }
            }
            return;
        }
    }

    if (state.action === 'update') {
        const field = state.field;
        const value = parseFloat(inputValue);
        if (isNaN(value) || ((field === 'account_percent_to_invest' || field === 'take_profit_1_amount' || field === 'take_profit_2_amount') && (value < 0.5 || value > 100))) {
            ctx.reply("Please enter a valid percentage value.");
        } else {
            await updateDatabaseField(ctx, field, value / 100);
        }
    }
});

async function updateDatabaseField(ctx: any, field: string, value: number) {
    try {
        const db = getDatabase("sniperbot-tg");
        await updateUserRecord(ctx.from.id.toString(), field, value, db);
        ctx.reply("Your settings have been updated successfully.");
    } catch (error) {
        ctx.reply("Failed to update settings. Please try again.");
        console.error(error);
    }
    userState.delete(ctx.from.id);  // Clean up state after handling
}






bot.action('ACTIVATE', async (ctx) => {

    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'ACTIVATE');

    if (isOnCooldown(telegramId.toString(), 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
        ctx.reply('Please wait a few seconds before using another button.');
        return;
    }

    if (isOnCooldown(telegramId, 'ACTIVATE', 10 * 1000)) {
        ctx.reply('You need to wait 10 seconds before using this command again.');
        return;
    }
    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");
    

    // Fetching the wallet info from the database
    const walletRecord = await findWalletByTelegramId(telegramId, db);
    if (!walletRecord) {
        ctx.reply("No wallet found. Please create a wallet first using /start.");
        return;
    }

    // Decrypt the wallet's secret key and instantiate the wallet object
    const decryptedSecretKey = decryptText(walletRecord.secretKey);
    const secretKeyArray = JSON.parse(decryptedSecretKey);
    const wallet = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));

    // Fetching wallet balances
    const balances = await get_wallet_balances_in_usd(wallet);
    const requiredSolBalance = 0.005; // Minimum SOL balance required
    const requiredUsdcBalance = 45; // Minimum USDC balance required in dollars

    if (balances.sol_balance < requiredSolBalance || balances.USDC_value < requiredUsdcBalance) {
        let message = `Insufficient balance to activate the wallet. Please ensure you have at least ${requiredSolBalance} SOL and $${requiredUsdcBalance} USDC in your wallet.`;
        ctx.reply(message);
        return;
    }

    const result = await activateWallet(telegramId, db);
    let message = "";
    if (result) {
        message = "Your wallet has been activated.";
    } else {
        message = "Failed to activate your wallet. Please try again later.";
    }
    // Redisplay the menu with updated button text
    display_menu(message, telegramId, ctx, db);
});

bot.action('DEACTIVATE', async (ctx) => {

    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'DEACTIVATE');

    if (isOnCooldown(telegramId, 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
        ctx.reply('Please wait a few seconds before using another button.');
        return;
    }

    if (isOnCooldown(telegramId, 'DEACTIVATE', 10 * 1000)) {
        ctx.reply('You need to wait 10 seconds before using this command again.');
        return;
    }
    
    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");

    

    

    const result = await deactivateWallet(telegramId, db);
    let message ="";
    if (result) {
        message = "Your wallet has been deactivated.";
    } else {
        message = "Failed to deactivate your wallet. Please try again later.";
    }
    // Redisplay the menu with updated button text
    
    display_menu(message, telegramId, ctx, db);
});



bot.action('balance', async (ctx) => {
    
    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'balance');

    if (isOnCooldown(telegramId.toString(), 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
        ctx.reply('Please wait a few seconds before using another button.');
        return;
    }

    if (isOnCooldown(telegramId, 'balance', 30 * 1000)) {
        ctx.reply('You need to wait 30 seconds before using this command again.');
        return;
    }

    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");


    ctx.reply('We are getting your Balance, please wait a moment...');
    // Fetch the user's wallet
    const existingWallet = await findWalletByTelegramId(telegramId, db);
    if (existingWallet) {
        const decryptedSecretKey = decryptText(existingWallet.secretKey);
        
        let wallet;
        try {
            const secretKeyArray = JSON.parse(decryptedSecretKey); // Parse JSON string to array
            wallet = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
        } catch (parseError) {
            console.error('Error parsing decrypted secret key:', parseError);
            ctx.reply('Failed to parse the decrypted secret key. Please try again later.');
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
List of SPL Tokens:
${balances.tokenDetails}


SOL Balance: ${balances.sol_balance.toFixed(6)}
SOL Value in USD: $${balances.sol_value_in_USD.toFixed(2)}
USDC Value: $${adjustedUSDCValue.toFixed(2)}
Tokens Value in USD: $${balances.tokens_USD_value.toFixed(2)}
Account Total in USD: $${adjustedTotalUSDInvested.toFixed(2)}

        `;

        ctx.reply(message);
    } else {
        ctx.reply("You do not have a wallet yet. Please use /start to create one.");
    }
});




bot.action('SELLALL', async (ctx) => {
    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'SELLALL');

    if (isOnCooldown(telegramId, 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
        ctx.reply('Please wait a few seconds before using another button.');
        return;
    }

    if (isOnCooldown(telegramId, 'SELLALL', 10 * 60 * 1000)) {
        ctx.reply('You need to wait 10 minutes before using this command again.');
        return;
    }

    ctx.reply("Please select the percentage to sell",
        Markup.inlineKeyboard([
            Markup.button.callback('10%', 'SELL_10'),
            Markup.button.callback('25%', 'SELL_25'),
            Markup.button.callback('50%', 'SELL_50'),
            Markup.button.callback('75%', 'SELL_75'),
            Markup.button.callback('100%', 'SELL_100')
        ])
    );
});

const percentages = {
    'SELL_10': 0.1,
    'SELL_25': 0.25,
    'SELL_50': 0.5,
    'SELL_75': 0.75,
    'SELL_100': 1
};

const sellCooldownTime = 15 * 60 * 1000;
const sellCommands = ['SELL_10', 'SELL_25', 'SELL_50', 'SELL_75', 'SELL_100'];

for (const [action, percentage] of Object.entries(percentages)) {
    bot.action(action, async (ctx) => {
        const username = ctx.from.username;
        const telegramId = ctx.from.id.toString();

        logAction(parseFloat(telegramId), username!, action);

        try {
            await connectToDatabase();
            const db = getDatabase("sniperbot-tg");

            if (sellCommands.some(cmd => isOnCooldown(telegramId, cmd, sellCooldownTime))) {
                ctx.reply('You need to wait 15 minutes before using any of the sell commands again.');
                return;
            }

            const walletRecord = await findWalletByTelegramId(telegramId, db);

            if (!walletRecord) {
                ctx.reply('Wallet not found. Please start the bot again.');
                return;
            }

            const decryptedSecretKey = decryptText(walletRecord.secretKey);
            const secretKeyArray = JSON.parse(decryptedSecretKey);
            const wallet = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));

            ctx.reply(`Initiating selling ${percentage * 100}% of your holdings, we will let you know as soon as all of the sell operations terminate.`);

            await sell_all(percentage, wallet, telegramId);

            ctx.reply(`All the Sell operations are now completed!`);
        } catch (error) {
            console.error('Error during sell operation:', error);
            ctx.reply('Failed to initiate sell operation. Please try again later.');
        }
    });
}

export const send_message_to_telegramId = async (message: string, telegramId: string) => {
    const url = `https://api.telegram.org/bot${process.env.Solana_Sniper_Club_bot_TOKEN!}/sendMessage`;
    const data = {
        chat_id: telegramId,
        text: message,
    };
 
     try {
         const response = await axios.post(url, data);
     } catch (error) {
         console.error('Error sending message:', error);
     }
 };

 export async function start_tg_sniper_bot() {
    bot.launch();
    console.log('Bot is running...');
 }


