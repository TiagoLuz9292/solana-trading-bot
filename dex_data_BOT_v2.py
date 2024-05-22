#!/usr/bin/env python3

import csv

import datetime
import os
import initial_list
import token_overview_list
import level_1_filter
import sys
import time
import threading
import level_2_filter
import OHLCV_filters
import birdeye_premium

#----------------------------------------------------------------------------------------------------------------------------------------

def reload():
    
    start_time = datetime.datetime.now().strftime("%d-%m-%y %H:%M:%S")

    while(True):
        print("Reloading token infos...")
        token_overview_list.get_token_overview_for_list("/root/project/solana-trading-bot/data/recent_tokens_list.csv", "/root/project/solana-trading-bot/data/token_overview_list.csv")
        level_1_filter.get_filtered_dexscreener()

        print("executing birdeye_premium.get_birdeye_security_for_list()")
        birdeye_premium.get_birdeye_security_for_list()
        print("executing birdeye_premium.filter_with_security()")
        birdeye_premium.filter_with_security()
        print("executing birdeye_premium.get_birdeye_overview_for_list()")
        birdeye_premium.get_birdeye_overview_for_list()
        print("executing birdeye_premium.filter_with_overview()")
        birdeye_premium.filter_with_overview()
        #level_2_filter.fetch_audit_data() 
        print("Preparing final list for buy_all_from_filtered()")
        token_overview_list.get_token_overview_for_list("/root/project/solana-trading-bot/data/final_filtered.csv", "/root/project/solana-trading-bot/data/tokens_to_buy.csv")

        print("Filter complete.")
        time.sleep(30)

#----------------------------------------------------------------------------------------------------------------------------------------

def reload_initial_list():
    csv_file_path = '/root/project/solana-trading-bot/data/data_logs.csv'
    start_time = datetime.datetime.now().strftime("%d-%m-%y %H:%M:%S")

   
    while(True):
        initial_list.get_token_list()
        token_overview_list.get_token_overview_for_list("/root/project/solana-trading-bot/data/initial_list_fresh.csv", "/root/project/solana-trading-bot/data/initial_overview.csv")
        token_overview_list.filter_recent_tokens()
        print("Initial list complete.")
        time.sleep(30)

#----------------------------------------------------------------------------------------------------------------------------------------

start_time = datetime.datetime.now().strftime("%d-%m-%y %H:%M:%S")

if len(sys.argv) < 2:
    print("Usage: python script_name.py case_number")
    sys.exit(1)

# Access the command-line argument
arg1 = sys.argv[1]

if arg1 == "initial-list":
    reload_initial_list()
elif arg1 == "reload":
    reload()   
else:
    print("BIRDEYE_BOT: Invalid command. Please provide one of the following inputs: \n\n->   token-list \n->   filter-token-list \n->   filter-new-launches\n")
    sys.exit(1)
