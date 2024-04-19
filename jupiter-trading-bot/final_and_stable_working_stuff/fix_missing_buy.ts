
import { BigNumber } from 'bignumber.js';
import { promises as fs } from 'fs';
import { Parser } from 'json2csv';
import {get_token_price} from './account_pnl';
import { getAllBalances, getTokenBalance } from './my_wallet';
import { create_sell_tracker_file, create_sell_tracker_file_v2, create_transactions_file, create_transactions_file_V2 } from './file_manager';
import { Keypair, Connection, ParsedConfirmedTransaction, TransactionSignature, TokenBalance, PublicKey, ParsedInstruction, Transaction, VersionedTransaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import dotenv from "dotenv";
import axios from "axios";
import { log } from 'console';
import path from 'path';
import fetch from 'node-fetch';
import { format } from 'date-fns';
import {send_message} from './telegram_bot';
import {update_pnl_after_buy_v2, update_account_PNL_v3, update_sell_tracker_after_sell} from '/root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/account_pnl';

interface TransactionData {
    tx_date: string;
    address: String;
    symbol: String;
    usd_spent: number;
    sol_spent: number;
    entryPrice: number;
    token_amount_received: number;
}
const now = new Date();
const isoDate = now.toISOString();

const datePart = isoDate.slice(0, 10); // yyyy-mm-dd
const timePart = isoDate.slice(11, 19); // hh:mm:ss

const currentDateTime = format(new Date(datePart + ' ' + timePart), 'dd-MM-yyyy HH:mm:ss');


const address= "FBghWHZYrd9XwtqVf6wW1eiqLmwAZX1dcS7w6jYtjmTE";
const symbol= "PEACE";
const usd_spent= 3;
const sol_spent= 0;
const entryPrice= 0.0001667;
const token_amount_received= 17988;

    const data: TransactionData[] = [{
        tx_date: currentDateTime,
        address: address,
        symbol: symbol,
        usd_spent: usd_spent,
        sol_spent: sol_spent,
        entryPrice: entryPrice,
        token_amount_received: token_amount_received
    }];

update_pnl_after_buy_v2(data);