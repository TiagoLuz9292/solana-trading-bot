
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


def update_birdeye_token_list():

    print("***** Retrieving Birdeye token list with first level Flters *****")
    url = "https://public-api.birdeye.so/public/tokenlist"
    headers = {"x-chain": "solana", "X-API-KEY": "eccc7565cb0c42ff85c19b64a640d41f"}
    initial_list.get_token_list(url, headers)
# Function to process case 1
    
def apply_dexscreener_overview():
    token_overview_list.get_token_overview_for_list()

def apply_advanced_filters():
    level_1_filter.get_filtered_dexscreener()

def full_token_list():
    
    level_2_filter.delete_file("/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/dexTools_token_list.csv")
    print("DEBUG - processing full token list")
    print("Getting first round of dexTools list...")
    page = 12
    page = level_2_filter.get_dexTools_list(3000, page)
    print("Getting second round of dexTools list...")
    time.sleep(10)
    page = level_2_filter.get_dexTools_list(3000, page)
    print("Getting third round of dexTools list...")
    time.sleep(10)
    page = level_2_filter.get_dexTools_list(3000, page)
    filter_initial_list()

    
    print("Hyper filtered csv file READY!!!")

def filter_initial_list():
    print("Getting Dexscreener Overview for Dextools full list...\n")
    token_overview_list.get_token_overview_for_list()
    print("Aplying Dexscreener filters to full list...\n")
    result = level_1_filter.get_filtered_dexscreener()
    if result is None:
        print("No data after filtering, Skipping.")
        return
    print("Aplying Dextools audit filters to Dexscreener filtered list...\n")
    result = level_2_filter.fetch_audit_data()
    if result is None:
        print("No data after audit filtering, Skipping.")
        return
    print("Filtering with Dextools holders count...\n")
    level_2_filter.filter_dextools_holders()

    print("Filtering with OHLCV...\n")
    OHLCV_filters.analyze_and_trade_5m()
    OHLCV_filters.analyze_and_trade_1m()
    
    print("OHLCV filtered csv FINAL file READY!!!")


def full_DEGENERATE_token_list():
    
    print("Getting DEGENERATE dexTools list...")
    level_2_filter.get_dexTools_DEGENERATE_list(1000)
    
    
    print("FULL DEGENERATE TOKEN LIST COMPLETE")    


    
def hourly_thread_func():
    while True:
        update_birdeye_token_list()
        time.sleep(3600)  # Sleep for 1 hour (3600 seconds) before the next iteration

# Function to run filtered_token_list() every 15 minutes
def fifteen_minutes_thread_func():
    while True:
        filtered_token_list()
        time.sleep(900)  # Sleep for 15 minutes (900 seconds) before the next iteration

def filtered_token_list():
    token_overview_list.get_token_overview_for_list()
    level_1_filter.get_filtered_dexscreener()

def start_bot(mode):
    
    if mode == "degen":
        while True:
            full_DEGENERATE_token_list()
            time.sleep(300)
    else:
        while True:
            full_token_list()
            time.sleep(120)  # Sleep for 
    #update_birdeye_token_list()
    counter = 0  # Counter to track the number of times filtered_token_list() has run
    #update_birdeye_token_list()

    while True:

        full_token_list()
        time.sleep(300)  # Sleep for 
        
def full_token_list_testing():
    
    print("DEBUG - Processing full token list\n")
    print("Getting initial list...\n")
    initial_list.get_token_list()
    print("Getting token overview list...\n")
    token_overview_list.get_token_overview_for_list()
    #token_overview_list.get_token_overview_for_list()
    #print("FILTERING DEXSCREENER LIST")
    #result = filter_dexscreener.get_filtered_dexscreener()
    #if result is None:
    #    print("No data after filtering, Skipping.")
    #    return
    print("Adding Dextools audit info to the list...")
    level_2_filter.add_audit_info_to_list()
    print("DONE")
    
    """
    
    print("Aplying Dextools audit filters to Dexscreener filtered list...")
    dextools_token_list.fetch_audit_data()
    print("FINAL filtering with Dextools holders count...")
    dextools_token_list.filter_dextools_holders()
    print("Hyper filtered csv file READY!!!")
    """

def append_to_csv(file_path, row_data):
    file_exists = os.path.exists(file_path)
    with open(file_path, mode='a', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=["timestamp", "description"])
        if not file_exists:
            writer.writeheader()  # Write the header if the file is new
        writer.writerow(row_data)

def reload():
    csv_file_path = 'data/data_logs.csv'
    start_time = datetime.datetime.now().strftime("%d-%m-%y %H:%M:%S")

    # Log the start of the reload function
    #append_to_csv(csv_file_path, {"timestamp": start_time, "description": "reload() function started."})
    while(True):
        print("Reloading token infos...")
        token_overview_list.get_token_overview_for_list("data/recent_tokens_list.csv")
        level_1_filter.get_filtered_dexscreener()
        level_2_filter.fetch_audit_data() 

        print("Filter complete.")
        time.sleep(900)

    #end_time = datetime.datetime.now().strftime("%d-%m-%y %H:%M:%S")
    # Log the completion of the reload function
    #append_to_csv(csv_file_path, {"timestamp": end_time, "description": "reload() function finished."})

def reload_initial_list():
    csv_file_path = '/data/data_logs.csv'
    start_time = datetime.datetime.now().strftime("%d-%m-%y %H:%M:%S")

    #append_to_csv(csv_file_path, {"timestamp": start_time, "description": "reload_initial_list() function started."})

    #initial_list.get_token_list()
    token_overview_list.get_token_overview_for_list("data/initial_list_fresh.csv")
    token_overview_list.filter_recent_tokens()

    #end_time = datetime.datetime.now().strftime("%d-%m-%y %H:%M:%S")
    # Log the completion of the reload function
    #append_to_csv(csv_file_path, {"timestamp": end_time, "description": "reload_initial_list() function finished."})

    reload()


# Check if the command-line argument is provided

start_time = datetime.datetime.now().strftime("%d-%m-%y %H:%M:%S")

    # Log the start of the reload function
append_to_csv('/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/data_logs.csv', {"timestamp": start_time, "description": "dex_data_BOT_v2.py called"})

if len(sys.argv) < 2:
    print("Usage: python script_name.py case_number")
    sys.exit(1)

# Access the command-line argument
arg1 = sys.argv[1]

# Switch case to call specific functions based on the argument value
if arg1 == "full-token-list":
    full_token_list()
elif arg1 == "filtered-token-list":
    filtered_token_list()    

elif arg1 == "bot-mode":
    start_bot("")

elif arg1 == "initial-list":
    reload_initial_list()
elif arg1 == "overview-list":
    token_overview_list.get_token_overview_for_list()
elif arg1 == "recent-list":
    token_overview_list.filter_recent_tokens()    
elif arg1 == "filter-1":
    level_1_filter.get_filtered_dexscreener()
elif arg1 == "filter-2":
    level_2_filter.fetch_audit_data()  
elif arg1 == "trading-list":
    full_token_list_testing()   
elif arg1 == "reload":
    reload()   
elif arg1 == "new-launch":
    level_2_filter.get_dexTools_list()   
elif arg1 == "list-test":
    full_token_list_testing()  
elif arg1 == "birdeye-list":
    update_birdeye_token_list() 
elif arg1 == "degenerate":
    full_DEGENERATE_token_list()
elif arg1 == "overview":
    if len(sys.argv) < 3:
        print("Missing the token name")
    else:
        token_address = sys.argv[2]
        token_overview_list.get_token_overview_for_token(token_address)   
else:
    print("BIRDEYE_BOT: Invalid command. Please provide one of the following inputs: \n\n->   token-list \n->   filter-token-list \n->   filter-new-launches\n")
    sys.exit(1)
