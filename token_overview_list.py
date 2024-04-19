"""
The below code executes a get request to an API and get a response, with a nested structure.
I will need to grab just some of the values in that json, and we will ignore the rest of them.
I will need that the response in json gets converted into a df, with just the needed values.
Below is an example of a response, I commented on the needed lines:
{
  "schemaVersion": "1.0.0",
  "pairs": [
    {
      "chainId": "solana",
      "dexId": "raydium",
      "url": "https://dexscreener.com/solana/6wpayoo7hhtujzgqavrpn4zwavqaxgvrpvm9voksvcau",
      "pairAddress": "6WPaYoo7hhtUJzGqaVrPn4ZwavqaXGVRpvM9VoKsVcAU",
      "baseToken": {
        "address": "CCYtdMhVtDfxR8zkM4vWxMcXUcGFYaesSjfBpt7XdnH4",
        "name": "nubpepe",
        "symbol": "nubpepe"
      },
      "quoteToken": {
        "address": "So11111111111111111111111111111111111111112",
        "name": "Wrapped SOL",
        "symbol": "SOL"
      },
      "priceNative": "0.000001143",
      "priceUsd": "0.0002167",
      "txns": {
        "m5": {
          "buys": 0,   
          "sells": 0
        },
        "h1": {
          "buys": 0,   # this should be a collumn with the name 'h1Buys' 
          "sells": 2   # this should be a collumn with the name 'h1Sells' 
        },
        "h6": {
          "buys": 16,
          "sells": 48
        },
        "h24": {
          "buys": 2754,   # this should be a collumn with the name '24hBuys'
          "sells": 2498   # this should be a collumn with the name '24hSells'
        }
      },
      "volume": {
        "h24": 418566.68,  # this should be a collumn with the name 'v24h'
        "h6": 1190.46,     
        "h1": 11.7,        # this should be a collumn with the name 'v1h'
        "m5": 0
      },
      "priceChange": {
        "m5": 0,
        "h1": -2.26,       # this should be a collumn with the name '1hPriceChange'
        "h6": -14,
        "h24": 52.51       # this should be a collumn with the name '24hPriceChange'
      },
      "liquidity": {
        "usd": 2219.08,    # this should be a collumn with the name 'liquidity'
        "base": 5137182,
        "quote": 5.8342
      },
      "fdv": 2167,
      "pairCreatedAt": 1711359966000,   # this should be a collumn with the name 'createdDateTime', and the value is in epoch time, convert it to UTC timezone with the format dd-mm-yy hh:mm:ss
      "info": {
        "imageUrl": "https://dd.dexscreener.com/ds-data/tokens/solana/CCYtdMhVtDfxR8zkM4vWxMcXUcGFYaesSjfBpt7XdnH4.png",
        "websites": [
          {
            "label": "Website",  
            "url": "https://www.nubpepe.com/"  # this should be a collumn with the name 'website'
          }
        ],
        "socials": [
          {
            "type": "twitter",
            "url": "https://twitter.com/nubpepe"  # this should be a collumn with the name 'twitter'
          },
          {
            "type": "telegram",
            "url": "https://t.me/nubpepe"   # this should be a collumn with the name 'telegram'
          }
        ]
      }
    }
  ]
}

After transforming the response json into the df with the needed values, save the df as .csv as "/data/dexscreener_list"
After that, also print the df with pretty printer with indent 4

output the full code with what I need, this is my base code for the request and transforming the response into json

import requests
import json

url = "https://api.dexscreener.com/latest/dex/tokens/CCYtdMhVtDfxR8zkM4vWxMcXUcGFYaesSjfBpt7XdnH4"

response = requests.get(url)

if response.status_code == 200:
    # Convert the response content to JSON format
    json_data = response.json()
    # Print the JSON data
    print(json.dumps(json_data, indent=2))
else:
    print("Failed to fetch data. Status code:", response.status_code)

"""

import json
import time
import numpy as np
import requests
import pandas as pd
from datetime import datetime, timedelta
from pytz import timezone
import pprint




def get_token_overview_for_token(token_address):
    uri = f"https://api.dexscreener.com/latest/dex/tokens/{token_address}"
    response = requests.get(uri)

    if response.status_code == 200:
        # Convert the response content to JSON format
        json_response = response.json()

        pprint.pprint(json_response)
        # Extract relevant data from the JSON response
        data = {
            'symbol': [json_response['pairs'][0]['baseToken']['symbol']],
            'pairAddress': [json_response['pairs'][0]['pairAddress']],
            'pairCreatedAt': [pd.to_datetime(json_response['pairs'][0]['pairCreatedAt'], unit='ms').strftime('%d-%m-%y %H:%M:%S')],
            'priceUsd': [json_response['pairs'][0]['priceUsd']],
            'h1Buys': [json_response['pairs'][0]['txns']['h1']['buys']],
            'h1Sells': [json_response['pairs'][0]['txns']['h1']['sells']],
            '24hBuys': [json_response['pairs'][0]['txns']['h24']['buys']],
            '24hSells': [json_response['pairs'][0]['txns']['h24']['sells']],
            'v1h': [json_response['pairs'][0]['volume']['h1']],
            'v24h': [json_response['pairs'][0]['volume']['h24']],
            '1hPriceChange': [json_response['pairs'][0]['priceChange']['h1']],
            '24hPriceChange': [json_response['pairs'][0]['priceChange']['h24']],
            'liquidity': [json_response['pairs'][0]['liquidity']['usd']],
            'marketCap': [json_response['pairs'][0]['fdv']]
        }

        # Create DataFrame from the extracted data
        df = pd.DataFrame(data)
        #
        pprint.pprint(df)
        return df
    else:
        print(f"Failed to fetch data for token address {token_address}. Status code:", response.status_code)
        
def filter_recent_tokens():
    # Load the CSV file into a DataFrame
    df = pd.read_csv('/root/project/solana-trading-bot/data/token_overview_list.csv')

    # Specify the exact format of the dates in the 'createdDateTime' column
    date_format = '%d-%m-%y %H:%M:%S'

    # Convert the 'createdDateTime' column to datetime format, specifying the exact format
    df['createdDateTime'] = pd.to_datetime(df['createdDateTime'], format=date_format, errors='coerce')

    # Calculate the cutoff date (10 days ago from now)
    cutoff_date = datetime.now() - timedelta(days=7)

    # Filter the DataFrame to keep only the rows where 'createdDateTime' is more recent than the cutoff date
    recent_df = df[df['createdDateTime'] > cutoff_date]

    # Before saving, check if recent_df is empty to avoid saving an empty file
    if not recent_df.empty:
        # Save the filtered DataFrame to a new CSV file
        recent_df.to_csv('/root/project/solana-trading-bot/data/recent_tokens_list.csv', index=False)
        print("Filtered data saved to data/recent_tokens_list.csv")
    else:
        print("No recent tokens found within the last 10 days.")
        
def get_token_overview_for_list(src_csv_file):
    df_addresses = pd.read_csv(src_csv_file)
    data_list = []

    # Split the addresses into manageable chunks
    address_chunks = [chunk.tolist() for chunk in np.array_split(df_addresses['address'], max(len(df_addresses) // 20, 1))]
    counter = 20
    for addresses_chunk in address_chunks:
        addresses_str = ','.join(addresses_chunk)
        uri = f"https://api.dexscreener.com/latest/dex/tokens/{addresses_str}"
        print(f"Fetching data...")

        time.sleep(1)  # Throttle the request rate
        try:
            response = requests.get(uri)
            
            if response.status_code == 200:
                print(f"Fetched overview for {counter} addresses")
                counter += 20
                print(f"Response code: {response.status_code}\n")
                json_data = response.json()

                pairs = json_data.get('pairs')
                if pairs is not None:
                    for pair in pairs:
                        liquidity = pair.get('liquidity', {}).get('usd', None)
                        marketCap = pair.get('fdv', None)
                        priceUSD = pair.get('priceUsd', None)

                        data = {
                            'createdDateTime': datetime.fromtimestamp(pair.get('pairCreatedAt', 0) / 1000, timezone('UTC')).strftime('%d-%m-%y %H:%M:%S'),
                            'address': pair['baseToken']['address'],
                            'symbol': pair['baseToken']['symbol'],
                            'pairAddress': pair['pairAddress'],
                            'buys_5m': pair['txns']['m5']['buys'],
                            'buys_1h': pair['txns']['h1']['buys'],
                            'buys_6h': pair['txns']['h6']['buys'],
                            'buys_24h': pair['txns']['h24']['buys'],
                            'sells_5m': pair['txns']['m5']['sells'],
                            'sells_1h': pair['txns']['h1']['sells'],
                            'sells_6h': pair['txns']['h6']['sells'],
                            'sells_24h': pair['txns']['h24']['sells'],
                            'volume_5m': pair['volume']['m5'],
                            'volume_1h': pair['volume']['h1'],
                            'volume_6h': pair['volume']['h6'],
                            'volume_24h': pair['volume']['h24'],
                            'priceChange_5m': pair['priceChange']['m5'],
                            'priceChange_1h': pair['priceChange']['h1'],
                            'priceChange_6h': pair['priceChange']['h6'],
                            'priceChange_24h': pair['priceChange']['h24'],
                            'liquidity': liquidity,
                            'marketCap': marketCap,
                            'priceUSD': priceUSD
                        }

                        if marketCap is not None:
                            data['marketCap'] = int(marketCap) if not pd.isna(marketCap) else None

                        if priceUSD is not None:
                            data['priceUSD'] = format(float(priceUSD), '.20f').rstrip('0').rstrip('.')

                        data['website'] = pair['info']['websites'][0]['url'] if 'info' in pair and 'websites' in pair['info'] and pair['info']['websites'] else None
                        data['twitter'] = next((s['url'] for s in pair['info']['socials'] if s['type'] == 'twitter'), None) if 'info' in pair and 'socials' in pair['info'] else None
                        data['telegram'] = next((s['url'] for s in pair['info']['socials'] if s['type'] == 'telegram'), None) if 'info' in pair and 'socials' in pair['info'] else None
                        data_list.append(data)
                else:
                    print(f"No 'pairs' found in the response for addresses: {addresses_str}")
            else:
                print(f"\nFailed to fetch data for addresses. Status code:", response.status_code)
        except requests.exceptions.RequestException as e:
            print(f"Error during API request for {addresses_str}: {e}")
            continue

    df_result = pd.DataFrame(data_list)
    print(f"Total tokens fetched: {len(data_list)}")
    if not data_list:
        print("No data fetched. Check API request format and limits.")

    # Drop duplicates based on the 'address' column
    df_result = df_result.drop_duplicates(subset='address', keep='first')
    df_result.to_csv("/root/project/solana-trading-bot/data/token_overview_list.csv", index=False)
    print("Data written to 'data/token_overview_list.csv'")

#get_token_overview_for_list()    