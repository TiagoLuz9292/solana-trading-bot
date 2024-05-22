import requests
import pandas as pd
import token_overview_list

filters_security = {
    #"creatorAddress": {"operator": "==", "value": None},
    #"creatorOwnerAddress": {"operator": "==", "value": None},
    #"ownerAddress": {"operator": "==", "value": None},
    #"ownerOfOwnerAddress": {"operator": "==", "value": None},
    #"creationTx": {"operator": "==", "value": None},
    #"creationTime": {"operator": "==", "value": None},
    #"creationSlot": {"operator": "==", "value": None},
    #"mintTx": {"operator": "==", "value": None},
    #"mintTime": {"operator": "==", "value": None},
    #"mintSlot": {"operator": "one_of_these"},
    #"creatorBalance": {"operator": "one_of_these"},
    #"ownerBalance": {"operator": "one_of_these"},
    "ownerPercentage": {"operator": "one_of_these_or_less_than", "value": 0.01},
    "creatorPercentage": {"operator": "one_of_these_or_less_than", "value": 0.01},
    #"metaplexUpdateAuthority": {"operator": "==", "value": "AqH29mZfQFgRpfwaPoTMWSKJ5kqauoc1FwVBRksZyQrt"},
    #"metaplexOwnerUpdateAuthority": {"operator": "one_of_these"},
    #"metaplexUpdateAuthorityBalance": {"operator": "one_of_these"},
    "metaplexUpdateAuthorityPercent": {"operator": "one_of_these_or_less_than", "value": 0.01},
    "mutableMetadata": {"operator": "==", "value": False},
    #"top10HolderBalance": {"operator": ">", "value": 3862556.615458747},
    #"top10HolderPercent": {"operator": "<", "value": 0.50},
    #"top10UserBalance": {"operator": ">", "value": 3448653.462576889},
    #"top10UserPercent": {"operator": "<", "value": 0.01},
    #"isTrueToken": {"operator": "one_of_these"},
    #"totalSupply": {"operator": ">=", "value": 500000000},
    #"preMarketHolder": {"operator": "one_of_these"},
    "lockInfo": {"operator": "one_of_these"},
    "freezeable": {"operator": "one_of_these"},
    "freezeAuthority": {"operator": "one_of_these"},
    "transferFeeEnable": {"operator": "one_of_these"},
    "transferFeeData": {"operator": "one_of_these"},
    "isToken2022": {"operator": "==", "value": False},
    "nonTransferable": {"operator": "one_of_these"}
}

filters_overview = {
    #"logoURI": {"operator": "==", "value": "https://img.fotofolio.xyz/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsolana-labs%2Ftoken-list%2Fmain%2Fassets%2Fmainnet%2FSo11111111111111111111111111111111111111112%2Flogo.png"},
    #"liquidity": {"operator": ">", "value": 5000000000},
    #"lastTradeUnixTime": {"operator": "<", "value": 1716288000},
    #"lastTradeHumanTime": {"operator": "==", "value": "2024-05-21T10:32:49"},
    #"price": {"operator": ">", "value": 180},
    #"history30mPrice": {"operator": "<=", "value": 183},
    #"priceChange30mPercent": {"operator": "==", "value": 0.18582555957823943},
    #"history1hPrice": {"operator": ">", "value": 180},
    #"priceChange1hPercent": {"operator": "one_of_these_or_less_than", "value": 1},
    #               "uniqueWallet30mChangePercent": {"operator": ">=", "value": 1},
    "uniqueWallet1hChangePercent": {"operator": "one_of_these_or_higher_than", "value": 0},
    #               "uniqueWallet2hChangePercent": {"operator": ">=", "value": 0.01},
    #               "uniqueWallet4hChangePercent": {"operator": ">=", "value": 0.05},
    #               "uniqueWallet8hChangePercent": {"operator": ">=", "value": 0.05},
    #"uniqueWallet24hChangePercent": {"operator": ">=", "value": 0.05},
    #"supply": {"operator": ">=", "value": 500000000},
    #"mc": {"operator": "<=", "value": 110000000000},
    #"circulatingSupply": {"operator": ">", "value": 500000000},
    #"realMc": {"operator": "==", "value": 105645614884.8087},
    #"holder": {"operator": "one_of_these_or_less_than", "value": 520000},
    #"trade30m": {"operator": "<=", "value": 150000},
    #"tradeHistory30m": {"operator": "<=", "value": 150000},
    #               "trade30mChangePercent": {"operator": ">=", "value": 0.01},
    #"sell30m": {"operator": "one_of_these_or_less_than", "value": 70000},
    #"sellHistory30m": {"operator": "one_of_these_or_less_than", "value": 80000},
    #"buy30m": {"operator": "one_of_these_or_less_than", "value": 60000},
    #"buyHistory30m": {"operator": "one_of_these_or_less_than", "value": 70000},
    #"v30m": {"operator": "one_of_these_or_less_than", "value": 180000},
    #"v30mUSD": {"operator": "one_of_these_or_less_than", "value": 46000000},
    #"vHistory30m": {"operator": "one_of_these_or_less_than", "value": 210000},
    #"vHistory30mUSD": {"operator": "one_of_these_or_less_than", "value": 50000000},
    #"vBuy30m": {"operator": "one_of_these_or_less_than", "value": 90000},
    #"vBuy30mUSD": {"operator": "one_of_these_or_less_than", "value": 16000000},
    #"vBuyHistory30m": {"operator": "one_of_these_or_less_than", "value": 110000},
    #"vBuyHistory30mUSD": {"operator": "one_of_these_or_less_than", "value": 18000000},
    #                  "vBuy30mChangePercent": {"operator": ">=", "value": 1},
    #"vSell30m": {"operator": "one_of_these_or_less_than", "value": 90000},
    #"vSell30mUSD": {"operator": "one_of_these_or_less_than", "value": 31000000},
    #"vSellHistory30m": {"operator": "one_of_these_or_less_than", "value": 100000},
    #"vSellHistory30mUSD": {"operator": "one_of_these_or_less_than", "value": 32000000},
    #"trade1h": {"operator": "one_of_these_or_less_than", "value": 270000},
    #"tradeHistory1h": {"operator": "one_of_these_or_less_than", "value": 250000},
    "trade1hChangePercent": {"operator": ">=", "value": 0},
    #"sell1h": {"operator": "one_of_these_or_less_than", "value": 150000},
    #"sellHistory1h": {"operator": "one_of_these_or_less_than", "value": 140000},
    #                  "sell1hChangePercent": {"operator": "one_of_these_or_less_than", "value": 10},
    #"buy1h": {"operator": "one_of_these_or_less_than", "value": 130000},
    #"buyHistory1h": {"operator": "one_of_these_or_less_than", "value": 120000},
    #                  "buy1hChangePercent": {"operator": "one_of_these_or_less_than", "value": 10},
    #"v1h": {"operator": "one_of_these_or_less_than", "value": 380000},
    #"v1hUSD": {"operator": "one_of_these_or_less_than", "value": 37000000},
    #"vHistory1h": {"operator": "one_of_these_or_less_than", "value": 270000},
    #"vHistory1hUSD": {"operator": "one_of_these_or_less_than", "value": 43000000},
    #"v1hChangePercent": {"operator": "one_of_these_or_less_than", "value": 50},
    #"vBuy1h": {"operator": "one_of_these_or_less_than", "value": 200000},
    #"vBuy1hUSD": {"operator": "one_of_these_or_less_than", "value": 8500000},
    #"vBuyHistory1h": {"operator": "one_of_these_or_less_than", "value": 140000},
    #"vBuyHistory1hUSD": {"operator": "one_of_these_or_less_than", "value": 3700000},
    "vBuy1hChangePercent": {"operator": ">=", "value": 0},
    #"vSell1h": {"operator": "one_of_these_or_less_than", "value": 190000},
    #"vSell1hUSD": {"operator": "one_of_these_or_less_than", "value": 28000000},
    #"vSellHistory1h": {"operator": "one_of_these_or_less_than", "value": 140000},
    #"vSellHistory1hUSD": {"operator": "one_of_these_or_less_than", "value": 40000000},
    #                  "vSell1hChangePercent": {"operator": "one_of_these_or_less_than", "value": 40},
    #"trade2h": {"operator": "one_of_these_or_less_than", "value": 520000},
    #"tradeHistory2h": {"operator": "one_of_these_or_less_than", "value": 500000},
    #                  "trade2hChangePercent": {"operator": "one_of_these_or_less_than", "value": 10},
    #"sell2h": {"operator": "one_of_these_or_less_than", "value": 280000},
    #"sellHistory2h": {"operator": "one_of_these_or_less_than", "value": 260000},
    #"sell2hChangePercent": {"operator": "one_of_these_or_less_than", "value": 10},
    #"buy2h": {"operator": "one_of_these_or_less_than", "value": 250000},
    #"buyHistory2h": {"operator": "one_of_these_or_less_than", "value": 230000},
    #"buy2hChangePercent": {"operator": "one_of_these_or_less_than", "value": 10},
    #"v2h": {"operator": "one_of_these_or_less_than", "value": 650000},
    #"v2hUSD": {"operator": "one_of_these_or_less_than", "value": 55000000},
    #"vHistory2h": {"operator": "one_of_these_or_less_than", "value": 630000},
    #"vHistory2hUSD": {"operator": "one_of_these_or_less_than", "value": 69000000},
    #"v2hChangePercent": {"operator": "one_of_these_or_less_than", "value": 10},
    #"vBuy2h": {"operator": "one_of_these_or_less_than", "value": 330000},
    #"vBuy2hUSD": {"operator": "one_of_these_or_less_than", "value": 5000000},
    #"vBuyHistory2h": {"operator": "one_of_these_or_less_than", "value": 310000},
    #"vBuyHistory2hUSD": {"operator": "one_of_these_or_less_than", "value": 6500000},
    #                  "vBuy2hChangePercent": {"operator": "one_of_these_or_less_than", "value": 10},
    #"vSell2h": {"operator": "one_of_these_or_less_than", "value": 330000},
    #"vSell2hUSD": {"operator": "one_of_these_or_less_than", "value": 49000000},
    #"vSellHistory2h": {"operator": "one_of_these_or_less_than", "value": 320000},
    #"vSellHistory2hUSD": {"operator": "one_of_these_or_less_than", "value": 62000000},
    #                  "vSell2hChangePercent": {"operator": "one_of_these_or_less_than", "value": 10},
    #"trade4h": {"operator": "one_of_these_or_less_than", "value": 1050000},
    #"tradeHistory4h": {"operator": "one_of_these_or_less_than", "value": 1100000},
    #                  "trade4hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"sell4h": {"operator": "one_of_these_or_less_than", "value": 550000},
    #"sellHistory4h": {"operator": "one_of_these_or_less_than", "value": 570000},
    #"sell4hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"buy4h": {"operator": "one_of_these_or_less_than", "value": 480000},
    #"buyHistory4h": {"operator": "one_of_these_or_less_than", "value": 500000},
    #"buy4hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"v4h": {"operator": "one_of_these_or_less_than", "value": 1300000},
    #"v4hUSD": {"operator": "one_of_these_or_less_than", "value": 84000000},
    #"vHistory4h": {"operator": "one_of_these_or_less_than", "value": 1400000},
    #"vHistory4hUSD": {"operator": "one_of_these_or_less_than", "value": 100000000},
    #"v4hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"vBuy4h": {"operator": "one_of_these_or_less_than", "value": 650000},
    #"vBuy4hUSD": {"operator": "one_of_these_or_less_than", "value": 64000000},
    #"vBuyHistory4h": {"operator": "one_of_these_or_less_than", "value": 680000},
    #"vBuyHistory4hUSD": {"operator": "one_of_these_or_less_than", "value": 60000000},
    #                  "vBuy4hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"vSell4h": {"operator": "one_of_these_or_less_than", "value": 640000},
    #"vSell4hUSD": {"operator": "one_of_these_or_less_than", "value": 20000000},
    #"vSellHistory4h": {"operator": "one_of_these_or_less_than", "value": 690000},
    #"vSellHistory4hUSD": {"operator": "one_of_these_or_less_than", "value": 40000000},
    #                  "vSell4hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"trade8h": {"operator": "one_of_these_or_less_than", "value": 2500000},
    #"tradeHistory8h": {"operator": "one_of_these_or_less_than", "value": 2600000},
    #                  "trade8hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"sell8h": {"operator": "one_of_these_or_less_than", "value": 1300000},
    #"sellHistory8h": {"operator": "one_of_these_or_less_than", "value": 1400000},
    #"sell8hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"buy8h": {"operator": "one_of_these_or_less_than", "value": 1100000},
    #"buyHistory8h": {"operator": "one_of_these_or_less_than", "value": 1200000},
    #"buy8hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"v8h": {"operator": "one_of_these_or_less_than", "value": 2700000},
    #"v8hUSD": {"operator": "one_of_these_or_less_than", "value": 81000000},
    #"vHistory8h": {"operator": "one_of_these_or_less_than", "value": 5000000},
    #"vHistory8hUSD": {"operator": "one_of_these_or_less_than", "value": 490000000},
    #"v8hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"vBuy8h": {"operator": "one_of_these_or_less_than", "value": 1300000},
    #"vBuy8hUSD": {"operator": "one_of_these_or_less_than", "value": 71000000},
    #"vBuyHistory8h": {"operator": "one_of_these_or_less_than", "value": 2600000},
    #"vBuyHistory8hUSD": {"operator": "one_of_these_or_less_than", "value": 280000000},
    #                  "vBuy8hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"vSell8h": {"operator": "one_of_these_or_less_than", "value": 1400000},
    #"vSell8hUSD": {"operator": "one_of_these_or_less_than", "value": 10000000},
    #"vSellHistory8h": {"operator": "one_of_these_or_less_than", "value": 2500000},
    #"vSellHistory8hUSD": {"operator": "one_of_these_or_less_than", "value": 200000000},
    #                  "vSell8hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"trade24h": {"operator": "one_of_these_or_less_than", "value": 7000000},
    #"tradeHistory24h": {"operator": "one_of_these_or_less_than", "value": 7100000},
    #                  "trade24hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"sell24h": {"operator": "one_of_these_or_less_than", "value": 3800000},
    #"sellHistory24h": {"operator": "one_of_these_or_less_than", "value": 3900000},
    #"sell24hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"buy24h": {"operator": "one_of_these_or_less_than", "value": 3400000},
    #"buyHistory24h": {"operator": "one_of_these_or_less_than", "value": 3500000},
    #"buy24hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"v24h": {"operator": "one_of_these_or_less_than", "value": 12000000},
    #"v24hUSD": {"operator": "one_of_these_or_less_than", "value": 1800000000},
    #"vHistory24h": {"operator": "one_of_these_or_less_than", "value": 10000000},
    #"vHistory24hUSD": {"operator": "one_of_these_or_less_than", "value": 1400000000},
    #"v24hChangePercent": {"operator": "one_of_these_or_less_than", "value": 20},
    #"vBuy24h": {"operator": "one_of_these_or_less_than", "value": 5700000},
    #"vBuy24hUSD": {"operator": "one_of_these_or_less_than", "value": 920000000},
    #"vBuyHistory24h": {"operator": "one_of_these_or_less_than", "value": 4900000},
    #"vBuyHistory24hUSD": {"operator": "one_of_these_or_less_than", "value": 700000000},
    #                  "vBuy24hChangePercent": {"operator": "one_of_these_or_less_than", "value": 20},
    #"vSell24h": {"operator": "one_of_these_or_less_than", "value": 5600000},
    #"vSell24hUSD": {"operator": "one_of_these_or_less_than", "value": 890000000},
    #"vSellHistory24h": {"operator": "one_of_these_or_less_than", "value": 4900000},
    #"vSellHistory24hUSD": {"operator": "one_of_these_or_less_than", "value": 700000000},
    #                  "vSell24hChangePercent": {"operator": "one_of_these_or_less_than", "value": 20},
    #"watch": {"operator": ">=", "value": 10},
    #"view30m": {"operator": "one_of_these_or_less_than", "value": 200},
    #"viewHistory30m": {"operator": "one_of_these_or_less_than", "value": 160},
    #                  "view30mChangePercent": {"operator": ">=", "value": 1},
    "view1h": {"operator": "one_of_these_or_higher_than", "value": 0},
    #"viewHistory1h": {"operator": "one_of_these_or_less_than", "value": 320},
    "view1hChangePercent": {"operator": "one_of_these_or_higher_than", "value": 0},
    #"view2h": {"operator": "one_of_these_or_less_than", "value": 700},
    #"viewHistory2h": {"operator": "one_of_these_or_less_than", "value": 720},
    #                  "view2hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"view4h": {"operator": "one_of_these_or_less_than", "value": 1300},
    #"viewHistory4h": {"operator": "one_of_these_or_less_than", "value": 1500},
    #                  "view4hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"view8h": {"operator": "one_of_these_or_less_than", "value": 2700},
    #"viewHistory8h": {"operator": "one_of_these_or_less_than", "value": 5000},
    #                  "view8hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    "view24h": {"operator": ">=", "value": 5},
    #"viewHistory24h": {"operator": "one_of_these_or_less_than", "value": 9000},
    #                  "view24hChangePercent": {"operator": "one_of_these_or_less_than", "value": 50},
    #"uniqueView30m": {"operator": "one_of_these_or_less_than", "value": 160},
    #"uniqueViewHistory30m": {"operator": "one_of_these_or_less_than", "value": 140},
    #                  "uniqueView30mChangePercent": {"operator": "one_of_these_or_less_than", "value": 30},
    "uniqueView1h": {"operator": "one_of_these_or_higher_than", "value": 0},
    #"uniqueViewHistory1h": {"operator": "one_of_these_or_less_than", "value": 250},
    "uniqueView1hChangePercent": {"operator": "one_of_these_or_higher_than", "value": 0},
    #"uniqueView2h": {"operator": "one_of_these_or_less_than", "value": 500},
    #"uniqueViewHistory2h": {"operator": "one_of_these_or_less_than", "value": 460},
    #                  "uniqueView2hChangePercent": {"operator": "one_of_these_or_less_than", "value": 10},
    #"uniqueView4h": {"operator": "one_of_these_or_less_than", "value": 900},
    #"uniqueViewHistory4h": {"operator": "one_of_these_or_less_than", "value": 920},
    #                  "uniqueView4hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    #"uniqueView8h": {"operator": "one_of_these_or_less_than", "value": 1600},
    #"uniqueViewHistory8h": {"operator": "one_of_these_or_less_than", "value": 2400},
    #                  "uniqueView8hChangePercent": {"operator": "one_of_these_or_less_than", "value": 0},
    "uniqueView24h": {"operator": ">=", "value": 5},
    #"uniqueViewHistory24h": {"operator": "one_of_these_or_less_than", "value": 4000},
    #                  "uniqueView24hChangePercent": {"operator": "one_of_these_or_less_than", "value": 50},
    #"numberMarkets": {"operator": "one_of_these_or_less_than", "value": 700000},
    "vBuy1hUSD_vs_vSell1hUSD": {"operator": ">", "columns": ["vBuy1hUSD", "vSell1hUSD"]}

}

def get_birdeye_overview_for_list():

    input_csv = "data/hyper_filtered.csv"
    output_csv = "data/birdeye_overview.csv"


    # Read the CSV file into a DataFrame
    df = pd.read_csv(input_csv)

    
    # Initialize an empty list to store the results
    results = []
    
    # Process each address
    for index, row in df.iterrows():
        address = row['address']
        try:
            # Get the security details for the address
            token_overview_df = get_birdeye_premium_overview_for_token(address)
            # Add the address to the DataFrame
            token_overview_df['address'] = address
            # Append the result to the list
            results.append(token_overview_df)
            
        except Exception as e:
            print(f"Error processing address {address}: {e}")
    
    # Concatenate all results into a single DataFrame
    if results:
        final_df = pd.concat(results, ignore_index=True)
        # Reorder columns to place 'address' first
        columns = ['address'] + [col for col in final_df.columns if col != 'address']
        final_df = final_df[columns]
        # Save the final DataFrame to a new CSV file
        final_df.to_csv(output_csv, index=False)
        print(f"Results saved to {output_csv}")
    else:
        print("No results to save.")

def get_birdeye_security_for_list():

    input_csv = "data/level_1_filter.csv"
    output_csv = "data/birdeye_security.csv"


    # Read the CSV file into a DataFrame
    df = pd.read_csv(input_csv)

    
    # Initialize an empty list to store the results
    results = []
    
    # Process each address
    for index, row in df.iterrows():
        address = row['address']
        try:
            # Get the security details for the address
            token_security_df = get_birdeye_premium_security_for_token(address)
            # Add the address to the DataFrame
            token_security_df['address'] = address
            # Append the result to the list
            results.append(token_security_df)
            
        except Exception as e:
            print(f"Error processing address {address}: {e}")
    
    # Concatenate all results into a single DataFrame
    if results:
        final_df = pd.concat(results, ignore_index=True)
        # Reorder columns to place 'address' first
        columns = ['address'] + [col for col in final_df.columns if col != 'address']
        final_df = final_df[columns]
        # Save the final DataFrame to a new CSV file
        final_df.to_csv(output_csv, index=False)
        print(f"Results saved to {output_csv}")
    else:
        print("No results to save.")



def get_birdeye_premium_overview_for_token(address: str) -> pd.DataFrame:
    url = f"https://public-api.birdeye.so/defi/token_overview?address={address}"
    headers = {"X-API-KEY": "eccc7565cb0c42ff85c19b64a640d41f"}
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        json_response = response.json()
        if 'data' in json_response:
            data = json_response['data']
            # Flatten the nested 'extensions' dictionary
            extensions = data.pop('extensions', {})
            data.update(extensions)
            df = pd.DataFrame([data])  # Convert the data dictionary to a DataFrame
            return df
        else:
            raise ValueError("Response JSON does not contain 'data' field")
    else:
        response.raise_for_status()


def get_birdeye_premium_security_for_token(address: str) -> pd.DataFrame:
    url = f"https://public-api.birdeye.so/defi/token_security?address={address}"
    headers = {"X-API-KEY": "eccc7565cb0c42ff85c19b64a640d41f"}
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        json_response = response.json()
        if 'data' in json_response:
            data = json_response['data']
            df = pd.DataFrame([data])  # Convert the data dictionary to a DataFrame
            return df
        else:
            raise ValueError("Response JSON does not contain 'data' field")
    else:
        response.raise_for_status()


def filter_with_security():

    filters = filters_security

    input_csv = "data/birdeye_security.csv"
    output_csv = "data/hyper_filtered.csv"

    # Read the CSV file into a DataFrame
    df = pd.read_csv(input_csv)

    # Apply filters to the DataFrame
    for column, condition in filters.items():
        if condition is not None:
            operator = condition.get('operator')
            value = condition.get('value')
            if operator == '==':
                df = df[df[column] == value]
            elif operator == '>':
                df = df[df[column] > value]
            elif operator == '<':
                df = df[df[column] < value]
            elif operator == '>=':
                df = df[df[column] >= value]
            elif operator == '<=':
                df = df[df[column] <= value]
            elif operator == '!=':
                df = df[df[column] != value]
            elif operator == 'one_of_these_or_less_than':
                if pd.api.types.is_string_dtype(df[column]):
                    df = df[
                        (df[column].isnull()) | 
                        (df[column] == 0) | 
                        (df[column] == '') | 
                        (df[column].str.lower() == 'none') | 
                        (df[column].str.lower() == 'undefined') | 
                        (df[column] < value)
                    ]
                else:
                    df = df[
                        (df[column].isnull()) | 
                        (df[column] == 0) | 
                        (df[column] == '') | 
                        (df[column] < value)
                    ]

    # Save the filtered DataFrame to a new CSV file
    df.to_csv(output_csv, index=False)
    print(f"Filtered results saved to {output_csv}")

# Example usage:
input_csv = 'data/birdeye_security.csv'
output_csv = 'data/hyper_filtered.csv'




def apply_custom_filters(df):
    custom_filters = {
        "vBuy1hUSD_vs_vSell1hUSD": {"operator": ">", "columns": ["vBuy1hUSD", "vSell1hUSD"]}
    }

    for key, condition in custom_filters.items():
        col1, col2 = condition['columns']
        operator = condition['operator']
        
        if operator == '>':
            df = df[df[col1] > df[col2]]
        elif operator == '<':
            df = df[df[col1] < df[col2]]
        elif operator == '>=':
            df = df[df[col1] >= df[col2]]
        elif operator == '<=':
            df = df[df[col1] <= df[col2]]
        elif operator == '==':
            df = df[df[col1] == df[col2]]
        elif operator == '!=':
            df = df[df[col1] != df[col2]]
    
    return df

def filter_with_overview():
    filters = filters_overview
    input_csv = "data/birdeye_overview.csv"
    output_csv = "data/final_filtered.csv"

    # Read the CSV file into a DataFrame
    df = pd.read_csv(input_csv)

    # Apply standard filters to the DataFrame
    for column, condition in filters.items():
        if condition is not None and 'columns' not in condition:
            operator = condition.get('operator')
            value = condition.get('value')

            if operator == '==':
                df = df[df[column] == value]
            elif operator == '>':
                df = df[df[column] > value]
            elif operator == '<':
                df = df[df[column] < value]
            elif operator == '>=':
                df = df[df[column] >= value]
            elif operator == '<=':
                df = df[df[column] <= value]
            elif operator == '!=':
                df = df[df[column] != value]
            elif operator == 'one_of_these_or_less_than':
                if pd.api.types.is_string_dtype(df[column]):
                    df = df[
                        (df[column].isnull()) | 
                        (df[column] == 0) | 
                        (df[column] == '') | 
                        (df[column].str.lower() == 'none') | 
                        (df[column].str.lower() == 'undefined') | 
                        (df[column] < value)
                    ]
                else:
                    df = df[
                        (df[column].isnull()) | 
                        (df[column] == 0) | 
                        (df[column] == '') | 
                        (df[column] < value)
                    ]
            elif operator == 'one_of_these_or_higher_than':
                if pd.api.types.is_string_dtype(df[column]):
                    df = df[
                        (df[column].isnull()) | 
                        (df[column] == 0) | 
                        (df[column] == '') | 
                        (df[column].str.lower() == 'none') | 
                        (df[column].str.lower() == 'undefined') | 
                        (df[column] > value)
                    ]
                else:
                    df = df[
                        (df[column].isnull()) | 
                        (df[column] == 0) | 
                        (df[column] == '') | 
                        (df[column] > value)
                    ]        

    # Apply custom comparison logic
    df = apply_custom_filters(df)

    # Save the filtered DataFrame to a new CSV file
    df.to_csv(output_csv, index=False)
    print(f"Filtered results saved to {output_csv}")



#get_birdeye_overview_for_list()
#get_birdeye_security_for_list()
#filter_with_security(filters)
#filter_with_overview()
#token_overview_list.get_token_overview_for_list("/root/project/solana-trading-bot/data/final_filtered.csv", "/root/project/solana-trading-bot/data/tokens_to_buy.csv")



