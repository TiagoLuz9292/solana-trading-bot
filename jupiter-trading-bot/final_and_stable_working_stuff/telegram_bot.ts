// API token: 6908427482:AAEa6Rf-ubtu2LhV1K-kFn7GQI6hb_g8Sd8
// My TG ID: 2088746736
// Group ID: -1002006874152
// BOT name: SMS_trading_Bot

import {getAllOpenOrders, getSellTrackerRecordsByQuery, getHighPriceChangeOrders, connectToDatabase, getDatabase} from './mongoDB_connection'
import {printTokenBalancesInUSD} from '/root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/my_wallet'
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
export {send_message, start_bot, send_message_to_private_group};
import fs from 'fs';
import csv from 'csv-parser';
import dotenv from "dotenv";
import { Db } from 'mongodb';

dotenv.config({ path: '/root/project/solana-trading-bot/jupiter-trading-bot/.env' });

const TOKEN = process.env.Solana_Sniper_Assistant_bot_TOKEN ;


const CHAT_ID = "-1002006874152";
const PRIVATE_GROUP_ID = "-1002087350809"

interface buy {
    symbol: string;
    PNL: string;
}


async function start_bot() {

  await connectToDatabase();
    
  const db = getDatabase("sniperbot");

  if (!TOKEN) {
    console.log("bot Token is null.");
    return;
  }
    const BOT = new TelegramBot(TOKEN, { polling: true });


    BOT.onText(/\/buys/, async (msg) => {
        try {
            get_open_trades(db);
        
        } catch (error) {
            console.error('Error retrieving balance:', error);
            await BOT.sendMessage(CHAT_ID, 'Failed to retrieve balance.');
        }
    });

    
    BOT.onText(/\/sells/, async (msg) => {
        try {
            get_sells(db);
        
        } catch (error) {
            console.error('Error retrieving balance:', error);
            await BOT.sendMessage(CHAT_ID, 'Failed to retrieve balance.');
        }
    });

    BOT.onText(/\/high/, async (msg) => {
      try {
        get_high_profit_trades(db);
      
      } catch (error) {
          console.error('Error retrieving balance:', error);
          await BOT.sendMessage(CHAT_ID, 'Failed to retrieve balance.');
      }
  });

}

async function get_high_profit_trades(db: Db): Promise<void> {
  try {
      console.log("Fetching high profit trades...");
      const records = await getHighPriceChangeOrders(db);

      if (records && records.length > 0) {
          const formattedMessages = records.map(record => {
              return `symbol: ${record.symbol}\naddress: ${record.address}\nprice_change_percent: ${record.price_change_percent}%`;
          });

          const finalMessage = formattedMessages.join('\n\n');
          send_message(finalMessage);
      } else {
          console.log('No records found or an error occurred.');
          send_message('No high profit trades found.');
      }
  } catch (error) {
      console.error('Error during high profit trades retrieval:', error);
      send_message('Failed to retrieve high profit trades.');
  }
}

function get_sells(db: Db): void {
  // Format today's date to match the format in the MongoDB collection (yyyy-mm-dd)
  const today = new Date();
  const dateString = today.toISOString().split('T')[0]; // Converts to "yyyy-mm-dd" format
  
  const query = {
    sell_date: {
      // Use a regular expression to match the date part of the sell_date string
      $regex: new RegExp(`^${dateString}`)
    }
  };

  getSellTrackerRecordsByQuery(query, db).then(records => {
    if (records.length > 0) {
      // Calculate the sum of profit_and_loss for each symbol
      const symbolSumMap = new Map<string, number>();
      records.forEach(record => {
        const symbol = record.symbol;
        const profitLoss = record.profit_and_loss ?? 0; // Use 0 if profit_and_loss is undefined
        if (symbolSumMap.has(symbol)) {
          symbolSumMap.set(symbol, symbolSumMap.get(symbol)! + profitLoss);
        } else {
          symbolSumMap.set(symbol, profitLoss);
        }
      });

      // Format the output message with symbol-wise profit/loss sums
      let message = '';
      symbolSumMap.forEach((sum, symbol) => {
        // Round the sum to two decimal places
        const roundedSum = sum.toFixed(2);
        message += `${symbol} -> ${roundedSum}\n`;
      });

      // Calculate the total sum of profit_and_loss for all records
      const totalSum = records.reduce((total, record) => total + (record.profit_and_loss ?? 0), 0);
      const roundedTotalSum = totalSum.toFixed(2); // Round the total sum to two decimal places

      // Append the total sum message to the output message
      message += `\nTotal Profit/Loss: ${roundedTotalSum}`;

      // Send the message using the existing send_message function
      send_message(message);
    } else {
      send_message("No sell records found for today.");
    }
  }).catch(error => {
    console.error('Failed to fetch records:', error);
    send_message(`Error retrieving records: ${error.message}`);
  });
}

async function get_open_trades(db: Db): Promise<void> {
    try {
      const openOrders = await getAllOpenOrders(db); // Retrieve all open orders
      for (const order of openOrders) {
        // Format the message with symbol, price change percent, and profit and loss
        const message = `${order.symbol} -> ${order.price_change_percent}% -> ${order.profit_and_loss}`;
        send_message(message); // Send the formatted message to Telegram
        await delayy(1000);
      }
    } catch (error) {
      console.error('Error getting open trades:', error);
    }
  }

const send_message_to_private_group = async (message: string) => {
   const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
   const data = {
       chat_id: PRIVATE_GROUP_ID,
       text: message,
   };

    try {
        const response = await axios.post(url, data);
    } catch (error) {
        console.error('Error sending message:', error);
    }
};

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

function delayy(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//send_message(`🟢‼️✅ NEW SELL 🚨🟢🔥\n\nSold: 159208.1397508 BONKO\nReceived:  0.03508191 SOL ($6.118859383681223 USD)\n\nToken address\n\nDbHuNmijFmK7F7peCSYZmF6yoi9Q3njBAdb3FCAkXNhS\n\n`);