#!/bin/bash

# Script settings
APP_NAME="OHLCV_filters:app"
SCREEN_NAME="ohlcv"
WORKING_DIR="/root/project/solana-trading-bot"
ENV_PATH="$WORKING_DIR/jupiter-trading-bot/.env"
LOG_DIR="$WORKING_DIR/logs"
LOG_FILE="$LOG_DIR/OHLCV.logs"
RELOAD_FLAG="--reload"  # Use "--reload" for development only, remove in production

# Ensure log directory exists
mkdir -p $LOG_DIR

# Full command to check and run
FULL_CMD="source $ENV_PATH && uvicorn $APP_NAME $RELOAD_FLAG > $LOG_FILE 2>&1"

# Check if the script with the same argument is already running
if pgrep -af "$FULL_CMD" > /dev/null; then
    echo "Error: An instance of Uvicorn serving $APP_NAME is already running."
    exit 1
else
    echo "No running instance of Uvicorn serving $APP_NAME found. Starting a new one."
    # Start a new screen session detached running the command
    screen -dmS $SCREEN_NAME bash -c "cd $WORKING_DIR && $FULL_CMD"
    echo "Uvicorn serving $APP_NAME started in screen session $SCREEN_NAME. Logs are being written to $LOG_FILE"
fi