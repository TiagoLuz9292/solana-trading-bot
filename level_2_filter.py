import os
import pprint
import time
import pandas as pd
import requests
from datetime import datetime, timedelta



def delete_file(csv_file):
    if os.path.exists(csv_file):
        os.remove(csv_file)
        print(f"File {csv_file} has been deleted.")
    else:
        print(f"File {csv_file} does not exist.")

def fetch_audit_data():
    csv_file = "/root/project/solana-trading-bot/data/level_1_filter.csv"
    output_file = "/root/project/solana-trading-bot/data/level_2_filter.csv"

    if not os.path.exists(csv_file) or os.path.getsize(csv_file) == 0:
        print("Source file is empty or does not exist.")
        return None

    df = pd.read_csv(csv_file)
    filtered_rows = []

    for index, row in df.iterrows():
        address = row['address']
        url = f"https://public-api.dextools.io/trial/v2/token/solana/{address}/audit"
        headers = {
            "accept": "application/json",
            "x-api-key": "t2UZtgUjAH07OL282qRu7hwNvJAmYik4uWY1E4w0"
        }
        time.sleep(2)
        response = requests.get(url, headers=headers)

        print(f"Status code for {address}: {response.status_code}")
        if response.status_code == 200:
            try:
                data = response.json()
                audit_data = data.get('data')
                print(f"Filtering audit info for {address}")
                if isinstance(audit_data, dict):
                    def check_value(key, expected_value):
                        return audit_data.get(key) == expected_value

                    conditions_met = all([
                        check_value('isOpenSource', 'yes'),
                        check_value('isHoneypot', 'no'),
                        check_value('isMintable', 'no'),
                        check_value('slippageModifiable', 'no'),
                        check_value('isContractRenounced', 'yes'),
                        check_value('isPotentiallyScam', 'no')
                    ])

                    if conditions_met:
                        filtered_rows.append(row)
                else:
                    print(f"No audit data found for address {address}")
            except requests.exceptions.JSONDecodeError:
                print(f"Failed to decode JSON for address {address}. Response: {response.text}")
        else:
            print(f"Failed to fetch data for address {address}, status code: {response.status_code}")

    if filtered_rows:
        filtered_df = pd.DataFrame(filtered_rows)
        filtered_df.to_csv(output_file, index=False)
        print(f"Filtered data saved to {output_file}")
        return filtered_df
    else:
        print("No data found that meets the criteria.")
        return None

def filter_dextools_holders():
    csv_file = "/root/project/solana-trading-bot/data/hyper_filtered_dextools.csv"
    output_file = "/root/project/solana-trading-bot/data/hyper_filtered_dextools_FINAL.csv"

    # Check if the file exists and is not empty before processing
    if not os.path.exists(csv_file) or os.path.getsize(csv_file) == 0:
        print("The file is empty or does not exist, skipping.")
        return

    df = pd.read_csv(csv_file)
    print("DF created from hyper filtered DEXTOOLS")
    print('Checking holders')

    filtered_rows = []

    for index, row in df.iterrows():
        address = row['address']
        url = f"https://public-api.dextools.io/trial/v2/token/solana/{address}/info"
        headers = {
            "accept": "application/json",
            "x-api-key": "t2UZtgUjAH07OL282qRu7hwNvJAmYik4uWY1E4w0"
        }
        time.sleep(2)  # Pause to prevent rate limiting
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            data = response.json()
            info_data = data.get('data', {})

            holders = info_data.get('holders', 0)  # Default to 0 if holders is None
            print(f"Holders for {address}: {holders}")

            if holders and holders > 20:  # Ensure holders is not None and greater than 100
                filtered_rows.append(row)
        else:
            print(f"Failed to fetch data for address {address}, status code: {response.status_code}")

    if filtered_rows:
        filtered_df = pd.DataFrame(filtered_rows)
        filtered_df.to_csv(output_file, index=False)
        print(f"Filtered data saved to {output_file}")
    else:
        print("No data found with holders more than 100.")

def get_dexTools_list():
    csv_file = "/root/project/solana-trading-bot/data/new_launch_list.csv"

    X = 24 # Hours ago
    now = datetime.utcnow()
    hours_ago = now - timedelta(hours=X)
    formatted_datetime = hours_ago.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    formatted_now = now.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    url_base = "https://public-api.dextools.io/trial/v2/pool/solana"
    headers = {
        "accept": "application/json",
        "x-api-key": "t2UZtgUjAH07OL282qRu7hwNvJAmYik4uWY1E4w0"
    }
    pageSize = 50
    tokens_fetched = 0
    tokens_to_fetch = 3000

    # Check if the file already has records (by checking its size)
    file_has_records = os.path.exists(csv_file) and os.path.getsize(csv_file) > 0

    while tokens_fetched < tokens_to_fetch:
        url = f"{url_base}?sort=creationTime&order=desc&from={formatted_datetime}&to={formatted_now}&pageSize={pageSize}"
        response = requests.get(url, headers=headers)
        time.sleep(1)  # Respectful pause to avoid rate-limiting
        if response.status_code == 200:
            data = response.json()
            results = data.get('data', {}).get('results', [])

            if results:
                records = [{
                    'address': item['mainToken']['address'],
                    'creationTime': item['creationTime'],
                    'poolAddress': item['address']
                } for item in results]

                df = pd.DataFrame(records)
                
                # Open the file in append mode ('a') and write without the header if the file already has records
                with open(csv_file, mode='a') as f:
                    df.to_csv(f, header=not file_has_records, index=False)
                
                tokens_fetched += len(results)
                print(f"Appended {len(results)} records to {csv_file}. Total fetched: {tokens_fetched}")

                # If we wrote the header this time, all subsequent writes should not include it
                file_has_records = True

            else:
                print("No more data returned from API.")
                break
        else:
            print(f"Failed to fetch data from the API, status code: {response.status_code}")
            break
    
    
        
def add_audit_info_to_list():
    src_file = "/root/project/solana-trading-bot/data/level_1_filter.csv.csv"
    dest_file = "/root/project/solana-trading-bot/data/level_2_filter.csv.csv"

    if not os.path.exists(src_file) or os.path.getsize(src_file) == 0:
        print("The source file is empty or does not exist.")
        return

    df = pd.read_csv(src_file)
    print("Reading data from source file...")

    # Add new columns for audit info
    df['isHoneypot'] = None
    df['isMintable'] = None
    df['isContractRenounced'] = None
    df['isPotentiallyScam'] = None
    counter = 0
    to_drop = []  # List to keep track of indices to drop

    for index, row in df.iterrows():
        address = row['address']
        url = f"https://public-api.dextools.io/trial/v2/token/solana/{address}/audit"
        headers = {
            "accept": "application/json",
            "x-api-key": "t2UZtgUjAH07OL282qRu7hwNvJAmYik4uWY1E4w0"
        }
        time.sleep(1)  # Delay to comply with rate limits
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            audit_data = response.json()
            data_section = audit_data.get('data')

            # Proceed only if data_section is a dictionary
            if isinstance(data_section, dict):
                df.at[index, 'isHoneypot'] = data_section.get('isHoneypot', 'unknown')
                df.at[index, 'isMintable'] = data_section.get('isMintable', 'unknown')
                df.at[index, 'isContractRenounced'] = data_section.get('isOpenSource', 'unknown')  # Assuming isOpenSource is used for isContractRenounced
                df.at[index, 'isPotentiallyScam'] = data_section.get('isBlacklisted', 'unknown')  # Assuming isBlacklisted is used for isPotentiallyScam
                counter += 1
                print(f"Line done: {counter}")
            else:
                # If data_section is not a dictionary, mark the index for dropping
                to_drop.append(index)
        else:
            print(f"Failed to fetch audit data for address {address}, status code: {response.status_code}")
            to_drop.append(index)

    # Drop the rows that we couldn't fetch data for
    df = df.drop(to_drop)

    print("Saving the updated data with audit info...")
    df.to_csv(dest_file, index=False)
    print(f"Updated data saved to {dest_file}")

def get_dexTools_DEGENERATE_list(tokens_to_fetch):
    csv_file = "/root/project/solana-trading-bot/data/dexTools_DEGENERATE_token_list.csv"

    X = 1  # Minutes ago
    now = datetime.utcnow()
    minutes_ago = now - timedelta(minutes=X)
    formatted_datetime = minutes_ago.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    formatted_now = now.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    url_base = "https://public-api.dextools.io/trial/v2/pool/solana"
    headers = {
        "accept": "application/json",
        "x-api-key": "t2UZtgUjAH07OL282qRu7hwNvJAmYik4uWY1E4w0"
    }
    page = 0
    pageSize = 20
    tokens_fetched = 0
    delete_file(csv_file)
    

    while tokens_fetched < tokens_to_fetch:
        time.sleep(2)
        url = f"{url_base}?sort=creationTime&order=desc&from={formatted_datetime}&to={formatted_now}&page={page}&pageSize={pageSize}"
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            data = response.json()
            results = data.get('data', {}).get('results', [])

            if results:
                records = [{
                    'address': item['mainToken']['address'],
                    'creationTime': item['creationTime']
                } for item in results]

                df = pd.DataFrame(records)

                with open(csv_file, mode='a') as f:
                    df.to_csv(f, header=f.tell()==0, index=False)
                
                tokens_fetched += len(results)
                print(f"Appended {len(results)} records to {csv_file}. Total fetched: {tokens_fetched}")

                page += 1  # Go to the next page
            else:
                print("No more data returned from API")
                break
        else:
            print(f"Failed to fetch data from the API, status code: {response.status_code}")
            break
