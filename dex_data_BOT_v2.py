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

#----------------------------------------------------------------------------------------------------------------------------------------

def reload():
    
    start_time = datetime.datetime.now().strftime("%d-%m-%y %H:%M:%S")

    while(True):
        print("Reloading token infos...")
        token_overview_list.get_token_overview_for_list("/root/project/solana-trading-bot/data/recent_tokens_list.csv")
        level_1_filter.get_filtered_dexscreener()
        level_2_filter.fetch_audit_data() 

        print("Filter complete.")
        time.sleep(15)

#----------------------------------------------------------------------------------------------------------------------------------------

def reload_initial_list():
    csv_file_path = '/root/project/solana-trading-bot/data/data_logs.csv'
    start_time = datetime.datetime.now().strftime("%d-%m-%y %H:%M:%S")

   
    while(True):
        initial_list.get_token_list()
        token_overview_list.get_token_overview_for_list("/root/project/solana-trading-bot/data/initial_list_fresh.csv")
        token_overview_list.filter_recent_tokens()
        print("Initial list complete.")
        time.sleep(300)

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
