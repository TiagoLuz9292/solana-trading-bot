#!/bin/bash
# Load environment variables
export $(cat /home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/.env | xargs)

# Run the script
/home/tluz/.nvm/versions/node/v18.20.0/bin/ts-node /home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/jupiter-trading-bot/final_and_stable_working_stuff/trading_BOT.ts buy-from-filtered