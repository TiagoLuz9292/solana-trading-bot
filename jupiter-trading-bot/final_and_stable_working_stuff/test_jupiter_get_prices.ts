import { Keypair } from '@solana/web3.js';
import {get_wallet_balances_in_usd_v2} from './my_wallet'
import dotenv from "dotenv";

dotenv.config({ path: '/root/project/solana-trading-bot/jupiter-trading-bot/.env' });

const secretKey = process.env.SECRET_KEY ? JSON.parse(process.env.SECRET_KEY) : null;
const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

(async () => {
    try {
      const balances = await get_wallet_balances_in_usd_v2(wallet);
      console.log('Balances:', balances);
    } catch (error) {
      console.error('Error fetching wallet balances:', error);
    }
  })();