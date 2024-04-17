// API token: 6908427482:AAEa6Rf-ubtu2LhV1K-kFn7GQI6hb_g8Sd8
// My TG ID: 2088746736
// Group ID: -1002006874152
// BOT name: SMS_trading_Bot

import {printTokenBalancesInUSD} from '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/my_wallet'
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
export {send_message, start_bot};
import fs from 'fs';
import csv from 'csv-parser';


const TOKEN = "6908427482:AAEa6Rf-ubtu2LhV1K-kFn7GQI6hb_g8Sd8";
const CHAT_ID = "-1002006874152";

interface buy {
    symbol: string;
    PNL: string;
}

interface sell {
    symbol: string;
    address: string;
    usd_received: number;
    usd_spent: number;
}

async function start_bot() {
    const BOT = new TelegramBot(TOKEN, { polling: true });


    BOT.onText(/\/buys/, async (msg) => {
        try {
            get_open_trades();
        
        } catch (error) {
            console.error('Error retrieving balance:', error);
            await BOT.sendMessage(CHAT_ID, 'Failed to retrieve balance.');
        }
    });

    BOT.onText(/\/sells/, async (msg) => {
        try {
            get_sells();
        
        } catch (error) {
            console.error('Error retrieving balance:', error);
            await BOT.sendMessage(CHAT_ID, 'Failed to retrieve balance.');
        }
    });

}

function get_sells(): void {
    const results: Map<string, number> = new Map();
    const filePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/sell_tracker_v2.csv";
    const today = new Date().toISOString().slice(0, 10); // Format: YYYY-MM-DD
    let totalResultUSD = 0; // Variable to accumulate the total result_usd

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data: any) => {
            // Convert "dd-mm-yyyy hh:mm:ss" to "yyyy-mm-dd" for comparison
            const sellDateParts = data.sell_date.split(' ')[0].split('-');
            const sellDateFormatted = `${sellDateParts[2]}-${sellDateParts[1]}-${sellDateParts[0]}`;

            if (sellDateFormatted === today) {
                const symbol = data.symbol;
                const resultUSD = parseFloat(data.result_usd);

                // Create string and add to results map
                const entryString = `${symbol} -> ${resultUSD.toFixed(2)}$`;
                results.set(entryString, resultUSD); // Corrected: Use entryString as the key and resultUSD as the value

                // Accumulate result_usd for total calculation
                totalResultUSD += resultUSD;
            }
        })
        .on('end', () => {
            // Concatenate strings and send formatted message
            const formattedString = Array.from(results.keys()).join('\n');
            send_message(formattedString);

            // Send total result_usd
            send_message(`Total result_usd: ${totalResultUSD.toFixed(2)}$`);
        })
        .on('error', (error: Error) => {
            console.error('Error reading and processing CSV file:', error);
        });
}

function get_open_trades(): void {
    const results: buy[] = [];
    const filePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/open_orders_v2.csv"

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data: any) => results.push({ symbol: data.symbol, PNL: data.PNL }))
        .on('end', () => {
            const formattedString = results.map(record => `${record.symbol} ->    ${record.PNL}`).join('\n');
            send_message(formattedString);
        })
        .on('error', (error: Error) => {
            console.error('Error reading and processing CSV file:', error);
        });
}

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