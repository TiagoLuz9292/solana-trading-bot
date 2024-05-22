import csv
import time
import requests
import json
import pandas as pd
from typing import List, Dict


def get_token_list() -> None:
    url = "https://public-api.birdeye.so/defi/tokenlist"
    headers = {"x-chain": "solana", "X-API-KEY": "702bd78965ff486f903388ebb3b4c4c3"}

    limit = 50
    offset = 0
    fetched_tokens = 0
    tokens_to_fetch = 45000
    csv_filename = '/root/project/solana-trading-bot/data/initial_list_fresh.csv'

    # Open the CSV file in write mode to overwrite existing data or create a new file
    with open(csv_filename, 'w', newline='') as file:
        writer = csv.writer(file)
        # Write the header
        writer.writerow(["address"])

    while offset < tokens_to_fetch:
    

        print(f"DEBUG: Iteration: Offset: {offset}, Total Tokens Fetched: {fetched_tokens}")
        print("*****************************************")

        params = {"sort_by": "mc", "sort_type": "desc", "offset": offset, "limit": limit}
        print("DEBUG: Waiting for response...")
        time.sleep(3)
        response = requests.get(url, headers=headers, params=params)

        if response.status_code == 200:
            print("DEBUG: Parsing response into json...")
            response_data = response.json()
            new_tokens = response_data.get('data', {}).get('tokens', [])

            if not new_tokens:
                print("No more tokens to fetch, exiting the loop.")
                break

            # Append new tokens to the CSV file
            with open(csv_filename, 'a', newline='') as file:
                writer = csv.writer(file)
                for token in new_tokens:
                    writer.writerow([token['address']])

            fetched_tokens += len(new_tokens)
            offset += limit
        else:
            print(f"Failed to retrieve data: {response.status_code}")
            time.sleep(3)
            

    print(f"Completed. {fetched_tokens} tokens fetched and saved to {csv_filename}.")
