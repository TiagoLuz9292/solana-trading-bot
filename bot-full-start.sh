#!/bin/bash

# Load the environment variables and aliases
source ~/.bashrc
source ~/.bash_aliases

# Call the aliases
echo "Starting Seller and trade management..."
start-pnl

echo "Starting OHLCV Check API..."
start-OHLCV-check

echo "Starting Buyer..."
start-buyer

echo "Starting the Reload script..."
start-reload

echo "Starting the Initial List script..."
start-initial-list

echo "Starting TG balance check..."
start-tg-balance

echo "All processes started."