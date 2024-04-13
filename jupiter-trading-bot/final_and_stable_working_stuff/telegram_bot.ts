// API token: 6908427482:AAEa6Rf-ubtu2LhV1K-kFn7GQI6hb_g8Sd8
// My TG ID: 2088746736
// Group ID: -1002006874152
// BOT name: SMS_trading_Bot

import {printTokenBalancesInUSD} from '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/my_wallet'
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
export {send_message};

const TOKEN = "6908427482:AAEa6Rf-ubtu2LhV1K-kFn7GQI6hb_g8Sd8";
const CHAT_ID = "-1002006874152";

//const BOT = new TelegramBot(TOKEN, { polling: true });

/*
BOT.onText(/\/balance/, async (msg) => {
    try {
        const balanceInfo = await printTokenBalancesInUSD();
        if (balanceInfo) {
            await send_message(balanceInfo);
        }
    } catch (error) {
        console.error('Error retrieving balance:', error);
        await BOT.sendMessage(CHAT_ID, 'Failed to retrieve balance.');
    }
});
*/

const send_message = async (message: string) => {
    const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
    const data = {
        chat_id: CHAT_ID,
        text: message,
    };

    try {
        const response = await axios.post(url, data);
    } catch (error) {
        console.error('Error sending message:', error);
    }
};

//send_message(`🟢‼️✅ NEW SELL 🚨🟢🔥\n\nSold: 159208.1397508 BONKO\nReceived:  0.03508191 SOL ($6.118859383681223 USD)\n\nToken address\n\nDbHuNmijFmK7F7peCSYZmF6yoi9Q3njBAdb3FCAkXNhS\n\n`);