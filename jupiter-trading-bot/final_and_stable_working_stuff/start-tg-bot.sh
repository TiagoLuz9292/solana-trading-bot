#!/bin/bash

source /root/project/solana-trading-bot/jupiter-trading-bot/.env

#!/bin/bash

# Script settings
SCRIPT_NAME="trading_BOT.ts"
SCRIPT_ARG="tg-bot-start"
SCREEN_NAME="tg-bot"
ENV_PATH="/root/project/solana-trading-bot/jupiter-trading-bot/.env"

# Full command to check and run
FULL_CMD="source $ENV_PATH && ts-node /root/project/solana-trading-bot/jupiter-trading-bot/final_and_stable_working_stuff/$SCRIPT_NAME $SCRIPT_ARG"

# Check if the script with the same argument is already running
if pgrep -af "$FULL_CMD" > /dev/null; then
    echo "Error: An instance of $SCRIPT_NAME with arg $SCRIPT_ARG is already running."
    exit 1
else
    echo "No running instance of $SCRIPT_NAME with arg $SCRIPT_ARG found. Starting a new one."
    # Start a new screen session detached running the script and log output
    screen -dmS $SCREEN_NAME bash -c "$FULL_CMD"
    echo "$SCRIPT_NAME $SCRIPT_ARG started in screen session $SCREEN_NAME."
fi