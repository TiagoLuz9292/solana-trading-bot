import { Telegraf, Markup, Context, Scenes, Composer, NarrowedContext  } from 'telegraf';
import { Message, Update } from 'telegraf/typings/core/types/typegram';
import { Keypair } from '@solana/web3.js';
import dotenv from "dotenv";
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { insertWalletData, findWalletByTelegramId, activateWallet_buyer, deactivateWallet_buyer, getWalletActivationStatus_buyer, checkTelegramIdExists, connectToDatabase, getDatabase, updateUserRecord, resetTaxesToPay, getWalletActivationStatus_seller, activateWallet_seller, deactivateWallet_seller, set_trade_mode_to_fixed, set_trade_mode_to_percent } from "./mongoDB_connection"; // Ensure the functions are correctly implemented
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import {  buy_wrapper, get_tokens_by_usdc_value, get_wallet_balances_in_usd_v2, sell_token_by_percentage, update_wallet_balances} from './my_wallet';
import { withdraw_USDC, pay_all_taxes, convert_USDT_to_USDC, convert_SOL_to_USDC, sell_token } from './my_wallet';
import { sell_all, sell_group } from './transaction_manager';
import { Db } from 'mongodb';
import session from 'telegraf/session';
import axios from 'axios';
import { TokenError } from '@solana/spl-token';
import { pre_and_post_buy_operations_for_ACTIVATED_wallets } from './jupiter_swap_STABLE_VERSION';



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
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//DISPLAY_MENUS
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

async function display_menu(message: string, telegramId: string, ctx: { reply: (arg0: string, arg1: Markup.Markup<InlineKeyboardMarkup>) => void; }, db: Db) {
    ctx.reply(message, 
        Markup.inlineKeyboard([
            [Markup.button.callback('📉Sell', 'SELLMENU'), Markup.button.callback('📈Buy', 'BUY')],
            [Markup.button.callback('🔄Convert', 'CONVERT'), Markup.button.callback('🎯Sniper Mode', 'SNIPERMODE')],
            [Markup.button.callback('🧾List Tokens', 'LISTTOKENS'), Markup.button.callback('📟Balance', 'balance')],
            [Markup.button.callback('⚙️Settings', 'SETTINGS'), Markup.button.callback('❓Help', 'HELP')]
            
        ])
    );
}

async function display_settings_menu(message: string, telegramId: string, ctx: { reply: (arg0: string, arg1: Markup.Markup<InlineKeyboardMarkup>) => void; }, db: Db) {
    
   
    try {
        const userSettings = await db.collection('tg_info').findOne({ telegramId: telegramId });
        if (!userSettings) {
            return;
        }

        const trade_value_percent = (userSettings.account_percent_to_invest * 100).toFixed(2);  // Assuming it's stored as a decimal, formatted to 0 decimal places
        const trade_value_fixed = userSettings.fixed_value_to_invest.toFixed(2);
        const tp1Amount = (userSettings.take_profit_1_amount * 100).toFixed(0);
        const tp2Amount = (userSettings.take_profit_2_amount * 100).toFixed(0);
        const auto_pause_percent = (userSettings.auto_pause_percent * 100).toFixed(0);

        const tradeMode = userSettings.trade_value_mode;

        let trade_mode_button_text = "";
        let trade_mode_button_action = "";
        if (tradeMode == "percent") {
            trade_mode_button_text = "Trade Value Mode:   % of available USDC";
            trade_mode_button_action = "ACTIVATE_FIXED";
        } else {
            trade_mode_button_text = "Trade Value Mode:    Fixed value in $$";
            trade_mode_button_action  = "ACTIVATE_PERCENTAGE";
        }

        

        ctx.reply(message,
            Markup.inlineKeyboard([
                [Markup.button.callback(`${trade_mode_button_text}`, trade_mode_button_action)],
                [Markup.button.callback(`Trade Value in % of USDC:    ${trade_value_percent}%`, 'EDIT_TRADE_PERCENT')],
                [Markup.button.callback(`Trade Value in fixed $$ :    $${trade_value_fixed}`, 'EDIT_TRADE_FIXED')],
                [Markup.button.callback(`Amount to Sell on TP 1:    ${tp1Amount}%`, 'EDIT_TP1_AMOUNT')],
                [Markup.button.callback(`Amount to Sell on TP 2:    ${tp2Amount}%`, 'EDIT_TP2_AMOUNT')],
                [Markup.button.callback(`USDC % for Auto Pause:    ${auto_pause_percent}%`, 'EDIT_AUTO_PAUSE')]
            ])
        );
    } catch (error) {
        console.error("Error fetching settings:", error);
    }
}

//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//HELP_BUTTONS
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

bot.action('HELP', (ctx) => {
    ctx.reply('Help Options:',
        Markup.inlineKeyboard([
            [Markup.button.callback('Bot Guide', 'botguide')],
            [Markup.button.callback('FAQ', 'faq')]
        ])
    );
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





//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//ACTIVATION_BUTTONS
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

bot.action('SNIPERMODE', async (ctx) => {

    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");

    const telegramId = ctx.from.id.toString();

    const activationStatus_buyer = await getWalletActivationStatus_buyer(telegramId, db);
    const activationStatus_seller = await getWalletActivationStatus_seller(telegramId, db);
    const buttonText_buyer = activationStatus_buyer ? 'Deactivate Buys' : 'Activate Buys';
    const callbackAction_buyer = activationStatus_buyer ? 'DEACTIVATE_BUYER' : 'ACTIVATE_BUYER';

    const buttonText_global = activationStatus_seller || activationStatus_buyer ? 'Deactivate Buy & Sell' : 'Activate Buy & Sell';
    const callbackAction_global = activationStatus_seller || activationStatus_buyer ? 'DEACTIVATE_BUYER_AND_SELLER' : 'ACTIVATE_BUYER_AND_SELLER';


    ctx.reply('Sniper Mode Options:',
        Markup.inlineKeyboard([
            [Markup.button.callback(buttonText_buyer, callbackAction_buyer), Markup.button.callback(buttonText_global, callbackAction_global)],
        ])
    );
});


bot.action('ACTIVATE_BUYER', async (ctx) => {

    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'ACTIVATE_BUYER');

    if (isOnCooldown(telegramId.toString(), 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
        ctx.reply('Please wait a few seconds before using another button.');
        return;
    }

    if (isOnCooldown(telegramId, 'ACTIVATE_BUYER', 10 * 1000)) {
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
    const balances = await get_wallet_balances_in_usd_v2(wallet);
    
    const requiredSolBalance = 0.005; // Minimum SOL balance required
    const requiredUsdcBalance = 45; // Minimum USDC balance required in dollars

    if (typeof balances.totalUSDInvested === 'string') {
        balances.totalUSDInvested = parseFloat(balances.totalUSDInvested);
    }
    
    if (balances.totalUSDInvested < 5) {
        let message = `Insufficient balance to activate the wallet. Please ensure you have at least ${requiredSolBalance} SOL and $${requiredUsdcBalance} USDC in your wallet.`;
        ctx.reply(message);
        return;
    }

    const result_buyer = await activateWallet_buyer(telegramId, db);
    const result_seller = await activateWallet_seller(telegramId, db);

    let message = "";
    if (result_buyer && result_seller) {
        message = "Your wallet Buyer has been Activated.";
    } else {
        message = "Failed to activate your wallet. Please try again later.";
    }
    // Redisplay the menu with updated button text
    display_menu(message, telegramId, ctx, db);
});

bot.action('ACTIVATE_BUYER_AND_SELLER', async (ctx) => {

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
    const balances = await get_wallet_balances_in_usd_v2(wallet);
    const requiredSolBalance = 0.005; // Minimum SOL balance required
    const requiredUsdcBalance = 45; // Minimum USDC balance required in dollars

    if (typeof balances.totalUSDInvested === 'string') {
        balances.totalUSDInvested = parseFloat(balances.totalUSDInvested);
    }
    
    if (balances.totalUSDInvested < 5) {
        let message = `Insufficient balance to activate the wallet. Please ensure you have at least ${requiredSolBalance} SOL and $${requiredUsdcBalance} USDC in your wallet.`;
        ctx.reply(message);
        return;
    }

    const result_buyer = await activateWallet_buyer(telegramId, db);
    const result_seller = await activateWallet_seller(telegramId, db);
    let message = "";
    if (result_buyer && result_seller) {
        message = "The Buyer has been activated on your wallet.";
    } else {
        message = "Failed to activate your wallet. Please try again later.";
    }
    // Redisplay the menu with updated button text
    display_menu(message, telegramId, ctx, db);
});

bot.action('DEACTIVATE_BUYER', async (ctx) => {

    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'DEACTIVATE_BUYER');

    if (isOnCooldown(telegramId, 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
        ctx.reply('Please wait a few seconds before using another button.');
        return;
    }

    if (isOnCooldown(telegramId, 'DEACTIVATE_BUYER', 10 * 1000)) {
        ctx.reply('You need to wait 10 seconds before using this command again.');
        return;
    }
    
    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");


    const result = await deactivateWallet_buyer(telegramId, db);
    let message ="";
    if (result) {
        message = "The Buyer has been deactivated on your wallet.";
    } else {
        message = "Failed to deactivate your wallet. Please try again later.";
    }
    // Redisplay the menu with updated button text
    
    display_menu(message, telegramId, ctx, db);
});

bot.action('DEACTIVATE_BUYER_AND_SELLER', async (ctx) => {

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


    const result_seller = await deactivateWallet_seller(telegramId, db);
    const result_buyer = await deactivateWallet_buyer(telegramId, db);
    let message ="";
    if (result_seller && result_buyer) {
        message = "Your wallet is now deactivated.";
    } else {
        message = "Failed to deactivate your wallet. Please try again later.";
    }
    // Redisplay the menu with updated button text
    
    display_menu(message, telegramId, ctx, db);
});



//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//LIST_BUTTONS
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

bot.action('LISTTOKENS', (ctx) => {
    ctx.reply('Choose an option:',
        Markup.inlineKeyboard([
            [Markup.button.callback('All tokens', 'ALLTOKENS')],
            [Markup.button.callback('Tokens by $ Value', 'TOKENSBYVALUE')]
        ])
    );
});

bot.action('ALLTOKENS', async (ctx) => {
    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();
  
    logAction(parseFloat(telegramId), username!, 'balance');
  
    if (isOnCooldown(telegramId.toString(), 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
      ctx.reply('Please wait a few seconds before using another button.');
      return;
    }
  
    if (isOnCooldown(telegramId, 'balance', 15 * 1000)) {
      ctx.reply('You need to wait 30 seconds before using this command again.');
      return;
    }
  
    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");
  
    ctx.reply('We are getting your Balance, please wait a moment...');
  
    const existingWallet = await findWalletByTelegramId(telegramId, db);
  
    console.log(`existing wallet: ${existingWallet}`);
  
    if (existingWallet) {
      const decryptedSecretKey = decryptText(existingWallet.secretKey);
  
      let wallet;
      try {
        const secretKeyArray = JSON.parse(decryptedSecretKey);
        wallet = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
      } catch (parseError) {
        console.error('Error parsing decrypted secret key:', parseError);
        ctx.reply('Failed to parse the decrypted secret key. Please try again later.');
        return;
      }
  
      console.log("Getting balances");
      const balances = await get_wallet_balances_in_usd_v2(wallet);
      const taxesToPay = existingWallet.taxes_to_pay || 0;
  
      const USDCValue = balances.USDC_value;
      const totalUSDInvested = typeof balances.totalUSDInvested === 'string' ? parseFloat(balances.totalUSDInvested) : balances.totalUSDInvested;
  
      const adjustedUSDCValue = USDCValue - taxesToPay;
      const adjustedTotalUSDInvested = totalUSDInvested - taxesToPay;
  
      let message = `List of SPL Tokens:\n${balances.tokenDetails}\n`;
  
      if (message.length > 4096) {
        message = message.slice(0, 4093) + '...';
      }
  
      ctx.reply(message);
    } else {
      ctx.reply("You do not have a wallet yet. Please use /start to create one.");
    }
  });


bot.action('TOKENSBYVALUE', (ctx) => {

    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'TOKENSBYVALUE');

   
    userState.set(ctx.from.id, { action: 'tokensbyvalue', step: 'usdvalue'}); // Set the step to token address input
    ctx.reply('Type the minimum token usd value to be displayed:');
    
});

bot.action('balance', async (ctx) => {
    
    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'balance');

    if (isOnCooldown(telegramId.toString(), 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
        ctx.reply('Please wait a few seconds before using another button.');
        return;
    }

    if (isOnCooldown(telegramId, 'balance', 15 * 1000)) {
        ctx.reply('You need to wait 30 seconds before using this command again.');
        return;
    }

    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");


    ctx.reply('We are getting your Balance, please wait a moment...');
    // Fetch the user's wallet
    const existingWallet = await findWalletByTelegramId(telegramId, db);

    console.log(`existing wallet: ${existingWallet}`);

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

Balances:

SOL Balance: ${balances.sol_balance.toFixed(6)}
SOL Value in USD: $${balances.sol_value_in_USD.toFixed(2)}
USDC Value: $${adjustedUSDCValue.toFixed(2)}
Tokens Value in USD: $${balances.tokens_USD_value.toFixed(2)}
Account Total in USD: $${adjustedTotalUSDInvested.toFixed(2)}

        `;
        console.log(message);
        ctx.reply(message);
    } else {
        ctx.reply("You do not have a wallet yet. Please use /start to create one.");
    }
});




//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//SELL_BUTTONS
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

bot.action('SELLMENU', (ctx) => {
    ctx.reply('Choose a sell option:',
        Markup.inlineKeyboard([
            [Markup.button.callback('Sell manual', 'SELL'), Markup.button.callback('Sell All', 'SELLALL'), Markup.button.callback('Sell by $ Value', 'SELLBYVALUE')]
        ])
    );
});

bot.action('SELL', (ctx) => {

    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'SELL');

    userState.set(ctx.from.id, { action: 'sell' }); // Set the user's current action to "sell"
        ctx.reply('Choose the percentage to sell:',
            Markup.inlineKeyboard([
                [Markup.button.callback('100%', 'sell_1')],
                [Markup.button.callback('75%', 'sell_0.75')],
                [Markup.button.callback('50%', 'sell_0.5')],
                [Markup.button.callback('25%', 'sell_0.25')]
            ])
        );
    });

// Handle callback queries for selling percentages
['sell_1', 'sell_0.75', 'sell_0.5', 'sell_0.25'].forEach(action => {
    bot.action(action, (ctx) => {

        const percentage = parseFloat(action.split('_')[1]);
        userState.set(ctx.from.id, { action: 'sell', step: 'tokenAddress', percentage }); // Set the step to token address input
        ctx.reply('Type the address of the token you want to sell:');
    });
});

bot.action('SELLBYVALUE', (ctx) => {

    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'SELLBYVALUE');

    userState.set(ctx.from.id, { action: 'sell' }); // Set the user's current action to "sell"
        ctx.reply('Choose the percentage to sell:',
            Markup.inlineKeyboard([
                [Markup.button.callback('100%', 'sell_1_by_usd')],
                [Markup.button.callback('75%', 'sell_0.75_by_usd')],
                [Markup.button.callback('50%', 'sell_0.5_by_usd')],
                [Markup.button.callback('25%', 'sell_0.25_by_usd')]
            ])
        );
    });

// Handle callback queries for selling percentages
['sell_1_by_usd', 'sell_0.75_by_usd', 'sell_0.5_by_usd', 'sell_0.25_by_usd'].forEach(action => {
    bot.action(action, (ctx) => {

        const percentage = parseFloat(action.split('_')[1]);
        userState.set(ctx.from.id, { action: 'sellbyvalue', step: 'usdvalue', percentage }); // Set the step to token address input
        ctx.reply('Type the minimum token usd value to be sold:');
    });
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


//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//CONVERT_BUTTONS
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

bot.action('CONVERT', (ctx) => {
    ctx.reply('Choose a conversion option:',
        Markup.inlineKeyboard([
            [Markup.button.callback('usdT -> usdC', 'USDT_TO_USDC')],
            [Markup.button.callback('SOL -> usdC', 'SOL_TO_USDC')]
        ])
    );
});

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

        const balances = await get_wallet_balances_in_usd_v2(wallet);
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

        const balances = await get_wallet_balances_in_usd_v2(wallet);
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


//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//SETTINGS_BUTTONS
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


bot.action('SETTINGS', async (ctx) => {

    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");  // Use the appropriate database name

    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'SETTINGS');

    if (isOnCooldown((ctx.from.id).toString(), 'all_buttons', SHARED_COOLDOWN_TIME, true)) {
        ctx.reply('Please wait a few seconds before using another button.');
        return;
    }

    display_settings_menu("Here is your settings:", telegramId, ctx, db);
    
});

const userState = new Map();

bot.action('ACTIVATE_FIXED', async (ctx) => {

    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");

    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'ACTIVATE_FIXED');

    await set_trade_mode_to_fixed(telegramId, db);
    display_settings_menu("Trade Value mode changed with success!", telegramId, ctx, db);
});

bot.action('ACTIVATE_PERCENTAGE', async (ctx) => {

    await connectToDatabase();
    const db = getDatabase("sniperbot-tg");

    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'ACTIVATE_PERCENTAGE');

    await set_trade_mode_to_percent(telegramId, db);
    display_settings_menu("Trade Value mode changed with success!", telegramId, ctx, db);
});

bot.action('EDIT_AUTO_PAUSE', async (ctx) => {
    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'EDIT_AUTO_PAUSE');

    ctx.reply("Please enter the % of total account USD value at which USDC should be to pause auto buys/sells:");
    userState.set(ctx.from.id, { action: 'update', field: 'auto_pause_percent' });
});

bot.action('EDIT_TRADE_PERCENT', async (ctx) => {
    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'EDIT_TRADE_PERCENT');

    ctx.reply("Please enter the new trade value percentage:");
    userState.set(ctx.from.id, { action: 'update', field: 'account_percent_to_invest' });
});

bot.action('EDIT_TRADE_FIXED', async (ctx) => {
    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'EDIT_TRADE_FIXED');

    ctx.reply("Please enter the new fixed trade value in $$:");
    userState.set(ctx.from.id, { action: 'update', field: 'fixed_value_to_invest' });
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


//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//WITHDRAW_BUTTONS
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


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

//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//BUY_BUTTONS
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


bot.action('BUY', (ctx) => {

    const username = ctx.from.username;
    const telegramId = ctx.from.id.toString();

    logAction(parseFloat(telegramId), username!, 'BUY');

    userState.set(ctx.from.id, { action: 'buy', step: 'amount' });
    ctx.reply('Type the amount of USDC you want to spend:');
    
    });

// Handle callback queries for selling percentages
['sell_1', 'sell_0.75', 'sell_0.5', 'sell_0.25'].forEach(action => {
    bot.action(action, (ctx) => {

        const percentage = parseFloat(action.split('_')[1]);
        userState.set(ctx.from.id, { action: 'sell', step: 'tokenAddress', percentage }); // Set the step to token address input
        ctx.reply('Type the address of the token you want to sell:');
    });
});


//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//USER_INPUT
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


bot.on('text', async (ctx) => {
    const state = userState.get(ctx.from.id);
    if (!state || !state.action) {
        return;  // Ignore if there's no action set
    }

    const inputValue = ctx.message.text.trim();

    userState.set(ctx.from.id, { action: 'tokensbyvalue', step: 'usdvalue'});

    if (state.action === 'tokensbyvalue' && state.step === 'usdvalue') {
        
        const usd_value = parseFloat(inputValue);
        if (isNaN(usd_value) || usd_value <= 0) {
            ctx.reply("Invalid input. Please enter a valid number.");
        } else {
            try {
                await connectToDatabase();
                const db = getDatabase("sniperbot-tg");
                const telegramId = ctx.from.id.toString();
                const existingWallet = await findWalletByTelegramId(telegramId, db);
                if (existingWallet) {
                    const decryptedSecretKey = decryptText(existingWallet.secretKey);
                    const secretKeyArray = JSON.parse(decryptedSecretKey); // Parse JSON string to array
                    const wallet = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
                    
                    const token_list_data = await get_tokens_by_usdc_value(usd_value, wallet);

                    const { concatenatedString, tokenCount, totalUsdValue } = token_list_data;

                    
                    ctx.reply(`Total number of tokens: ${tokenCount}`);
                    ctx.reply(`Tokens with USD value greater than ${usd_value}:\n\n${concatenatedString}`);
                    ctx.reply(`Total USD value: $${totalUsdValue.toFixed(2)}`);
                    
                    userState.delete(ctx.from.id); // Clear the user state
                }
            } catch (error) {
                console.error('Error during withdrawal process:', error);
                ctx.reply('An error occurred during the withdrawal process. Please try again later.');
            }
            
        }
        return;
    }

    if (state.action === 'sellbyvalue' && state.step === 'usdvalue') {
        // Check if the token address is empty or contains spaces or special characters
        const usd_value = parseFloat(inputValue);
        if (isNaN(usd_value) || usd_value <= 0) {
            ctx.reply("Invalid input. Please enter a valid number.");
        } else {
        try {
            await connectToDatabase();
            const db = getDatabase("sniperbot-tg");
            const telegramId = ctx.from.id.toString();
            const existingWallet = await findWalletByTelegramId(telegramId, db);
            if (existingWallet) {
                const decryptedSecretKey = decryptText(existingWallet.secretKey);
                const secretKeyArray = JSON.parse(decryptedSecretKey); // Parse JSON string to array
                const wallet = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
                
                ctx.reply(`Selling all tokens that are valued in more than $${usd_value}`);
                await sell_group(usd_value, state.percentage, wallet, telegramId);
                ctx.reply(`All operations completed`);
                userState.delete(ctx.from.id); // Clear the user state
            }
        } catch (error) {
            console.error('Error during withdrawal process:', error);
            ctx.reply('An error occurred during the withdrawal process. Please try again later.');
        }
        }
        return;
    }

    if (state.action === 'buy' && state.step === 'amount') {
        // Check if the token address is empty or contains spaces or special characters
        const amount = parseFloat(inputValue);
            if (isNaN(amount) || amount <= 0) {
                ctx.reply("Invalid amount. Please enter a valid number.");
            } else {
                userState.set(ctx.from.id, { action: 'buy', step: 'tokenAddress', amount });
                ctx.reply("Insert the token address to buy:");
            }
            return;
    }
    if (state.action === 'buy' && state.step === 'tokenAddress') {
        // Check if the token address is empty or contains spaces or special characters
        const tokenAddress = inputValue;
        if (!tokenAddress || /\s/.test(tokenAddress) || /[^a-zA-Z0-9]/.test(tokenAddress)) {
            ctx.reply("Invalid token address. Please enter a valid token address without spaces or special characters.");
        } else {

            const telegramId = ctx.from.id.toString();
            await connectToDatabase();
            const db = getDatabase("sniperbot-tg");
                
            const existingWallet = await findWalletByTelegramId(telegramId, db);
                
            if (existingWallet) {
                const decryptedSecretKey = decryptText(existingWallet.secretKey);
                try {
                    const secretKeyArray = JSON.parse(decryptedSecretKey); // Parse JSON string to array
                    const wallet = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
                
                    
                    await pre_and_post_buy_operations_for_ACTIVATED_wallets(state.amount, tokenAddress, wallet, telegramId);
                    
                    
                } catch (parseError) {
                    console.error('Error parsing decrypted secret key:', parseError);
                    
                }
            }
        }
        return;
    }

    if (state.action === 'sell' && state.step === 'tokenAddress') {
        // Check if the token address is empty or contains spaces or special characters
        if (!inputValue || /\s/.test(inputValue) || /[^a-zA-Z0-9]/.test(inputValue)) {
            ctx.reply("Invalid token address. Please enter a valid token address without spaces or special characters.");
        } else {
            userState.set(ctx.from.id, { action: 'sell', step: 'confirm', tokenAddress: inputValue, percentage: state.percentage });
            ctx.reply(`Confirm sell ${state.percentage * 100}% of tokens at address: ${inputValue} [Yes/No]?`);
        }
        return;
    }
    
    // Handling confirmation response
    if (state.action === 'sell' && state.step === 'confirm') {
        const confirmation = inputValue.trim().toLowerCase();  // Normalize the input for comparison
        if (confirmation === 'yes') {

            
            ctx.reply("Sell order is being processed.");
            await sell_token_by_percentage(state.percentage, state.tokenAddress, (ctx.from.id).toString());  // Assuming sell_token function exists and needs user ID, token address, and percentage
            
        } else if (confirmation === 'no') {
            ctx.reply("Sell order cancelled.");
        } else {
            ctx.reply("Invalid response. Please type 'Yes' or 'No' to confirm.");
        }
        return;
    }

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

    if (state && state.action === 'update') {
        const inputValue = ctx.message.text;
        await handleUpdate(ctx, state.field, inputValue);
    }
    
});

async function handleUpdate(ctx: Context, field: string, inputValue: string): Promise<void> {
    
    let value = parseFloat(inputValue);

    if (field !== 'fixed_value_to_invest') {
        value = value / 100;
    }

    if (isNaN(value) || ((field !== 'fixed_value_to_invest') && (value < 0.005 || value > 1)) || (field === 'fixed_value_to_invest' && (value < 0.5 || value > 100))) {
        ctx.reply("Please enter a valid percentage value.");
    } else {
        await updateDatabaseField(ctx, field, value);
        ctx.reply("Value updated successfully.");
    }
}

async function updateDatabaseField(ctx: Context, field: string, value: number): Promise<void> {
    
    const telegramId = ctx.from!.id.toString();
    try {
        const db = getDatabase("sniperbot-tg");
        await updateUserRecord(ctx.from!.id.toString(), field, value, db);
        display_settings_menu("Your settings have been updated successfully.", telegramId, ctx, db);
    } catch (error) {
        ctx.reply("Failed to update settings. Please try again.");
        console.error(error);
    }
    userState.delete(ctx.from!.id);  // Clean up state after handling
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


