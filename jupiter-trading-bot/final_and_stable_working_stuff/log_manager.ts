import { Keypair } from "@solana/web3.js";

const fs = require('fs');
const path = require('path');

const buyLogFilePath = path.join(__dirname, 'buys.log');
const failedBuyLogFilePath = path.join(__dirname, 'failed_buys.log');
const sellLogFilePath = path.join(__dirname, 'sells.log');
const failedSellLogFilePath = path.join(__dirname, 'failed_sells.log');

const webSocketErrorFilePath = path.join(__dirname, 'webSocket_errors.log');

export function logWebSocketAction(wallet_address: string, usdc_received: string, token_address: string, signature: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}]\nWallet: ${wallet_address}\nToken: ${token_address}\nUSDC spent: ${usdc_received}\nSignature: ${signature}\n`;
    console.log("************************");
    console.log(logMessage);
    console.log("************************");
    fs.appendFile(sellLogFilePath, logMessage, (err: NodeJS.ErrnoException | null) => {
        if (err) {
            console.error('Error logging action:', err);
        }
    });
}

export function logSellAction(wallet_address: string, usdc_received: string, token_address: string, signature: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}]\nWallet: ${wallet_address}\nToken: ${token_address}\nUSDC spent: ${usdc_received}\nSignature: ${signature}\n`;
    console.log("************************");
    console.log(logMessage);
    console.log("************************");
    fs.appendFile(sellLogFilePath, logMessage, (err: NodeJS.ErrnoException | null) => {
        if (err) {
            console.error('Error logging action:', err);
        }
    });
}

export function logFailedSellAction(wallet_address: string, token_amount_sold: string, token_address: string, error: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}]\nWallet: ${wallet_address}\nToken: ${token_address}\nToken amount sold: ${token_amount_sold}\nError: ${error}\n`;
    console.log("************************");
    console.log(logMessage);
    console.log("************************");
    fs.appendFile(failedSellLogFilePath, logMessage, (err: NodeJS.ErrnoException | null) => {
        if (err) {
            console.error('Error logging action:', err);
        }
    });
}


export function logBuyAction(wallet_address: string, usdc_spent: string, token_address: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}]\nWallet: ${wallet_address}\nToken: ${token_address}\nUSDC spent: ${usdc_spent}\n`;
    console.log("************************");
    console.log(logMessage);
    console.log("************************");
    fs.appendFile(buyLogFilePath, logMessage, (err: NodeJS.ErrnoException | null) => {
        if (err) {
            console.error('Error logging action:', err);
        }
    });
}

export function logFailedBuyAction(wallet_address: string, usdc_spent: string, token_address: string, error: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}]\nWallet: ${wallet_address}\nToken: ${token_address}\nUSDC spent: ${usdc_spent}\nError: ${error}\n`;
    console.log("************************");
    console.log(logMessage);
    console.log("************************");
    fs.appendFile(failedBuyLogFilePath, logMessage, (err: NodeJS.ErrnoException | null) => {
        if (err) {
            console.error('Error logging action:', err);
        }
    });
}