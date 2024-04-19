#!/bin/bash

# Script settings
SCRIPT_NAME="dex_data_BOT_v2.py"
SCRIPT_ARG="initial-list"
SCREEN_NAME="initial-list"
ENV_PATH="/root/project/solana-trading-bot/jupiter-trading-bot/.env"

# Full command to check and run
FULL_CMD="source $ENV_PATH && python3 /root/project/solana-trading-bot/$SCRIPT_NAME $SCRIPT_ARG"

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