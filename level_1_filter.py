"""
initial_filter = (
            #(df['priceChange_5m'] > MIN_PRICE_CHANGE_5M) &
            #(df['priceChange_1h'] > MIN_PRICE_CHANGE_1H) &
            #(df['priceChange_6h'] > MIN_PRICE_CHANGE_6H) &
            #(df['priceChange_24h'] > MIN_PRICE_CHANGE_24H) &
            #(df['volume_5m'] >= MIN_VOLUME_5M) &
            #(df['volume_1h'] >= MIN_VOLUME_1H) &
            #(df['volume_6h'] >= MIN_VOLUME_6H) &
            #(df['volume_24h'] >= MIN_VOLUME_24H) &
            #(df['buys_5m'] > MIN_BUYS_5M) &
            (df['buys_1h'] > MIN_BUYS_1H) &
            #(df['buys_6h'] > MIN_BUYS_6H) &
            #(df['buys_24h'] > MIN_BUYS_24H) &
            #(df['sells_5m'] <= df['buys_5m'] * 0.6) &
            (df['sells_1h'] <= df['buys_1h'] * 0.6) &
            #(df['sells_6h'] <= df['buys_6h'] * 0.6) &
            #(df['sells_24h'] <= df['buys_24h'] * 0.6) &
            (df['marketCap'] >= MIN_MARKET_CAP) & (df['marketCap'] <= MAX_MARKET_CAP) &
            (df['liquidity'] >= MIN_LIQUIDITY)
        )
"""

from datetime import datetime, timedelta
import pandas as pd

# price change
MIN_PRICE_CHANGE_5M = 10
MIN_PRICE_CHANGE_1H = -70
MIN_PRICE_CHANGE_6H = 10
MIN_PRICE_CHANGE_24H = 10

# volume
MIN_VOLUME_5M = 1000
MIN_VOLUME_1H = 500
MIN_VOLUME_6H = 1000
MIN_VOLUME_24H = 1000

# buys
MIN_BUYS_5M = 1000
MIN_BUYS_1H = 1000
MIN_BUYS_6H = 1000
MIN_BUYS_24H = 1000

# sells
MAX_SELLS_5M = 1000
MAX_SELLS_1H = 1000
MAX_SELLS_6H = 1000
MAX_SELLS_24H = 1000

# market cap

MIN_MARKET_CAP = 1
MAX_MARKET_CAP = 150000

# liquidity

MIN_LIQUIDITY = 400





# Read the CSV file into a DataFrame


# Check if the required columns exist in the DataFrame

def get_filtered_dexscreener():
    csvPathToSave = 'data/level_1_filter.csv'
    source_file = 'data/recent_tokens_list.csv'

    df = pd.read_csv(source_file)

    # Specify the columns you want to ensure exist in the DataFrame
    required_columns = [
        'createdDateTime', 'priceChange_5m', 'priceChange_1h', 'priceChange_6h', 'priceChange_24h', 
        'volume_5m', 'volume_1h', 'volume_6h', 'volume_24h', 
        'buys_5m', 'buys_1h', 'buys_6h', 'buys_24h', 
        'sells_5m', 'sells_1h', 'sells_6h', 'sells_24h', 
        'marketCap', 'liquidity', 'website', 'twitter', 'telegram'
    ]

    if all(col in df.columns for col in required_columns):
        # Correct date format according to your actual data
        date_format = '%Y-%m-%d %H:%M:%S'
        df['createdDateTime'] = pd.to_datetime(df['createdDateTime'], format=date_format)

        # Add your filter criteria here as necessary
        initial_filter = (
            #(df['priceChange_5m'] > 0) &
            (df['priceChange_1h'] > -20) &
            #(df['priceChange_6h'] > MIN_PRICE_CHANGE_6H) &
            #(df['priceChange_24h'] > MIN_PRICE_CHANGE_24H) &
            #(df['volume_5m'] >= MIN_VOLUME_5M) &
            (df['volume_1h'] >= MIN_VOLUME_1H) &
            #(df['volume_6h'] >= MIN_VOLUME_6H) &
            #(df['volume_24h'] >= MIN_VOLUME_24H) &
            (df['buys_5m'] >= df['sells_5m']) &
            (df['buys_1h'] >= df['sells_1h']) &
            #(df['buys_6h'] > MIN_BUYS_6H) &
            #(df['buys_24h'] > MIN_BUYS_24H) &
            #(df['sells_5m'] <= df['buys_5m'] * 0.6) &
            (df['sells_1h'] <= df['buys_1h'] * 0.7) &
            #(df['sells_6h'] <= df['buys_6h'] * 0.6) &
            (df['sells_24h'] <= df['buys_24h'] * 0.7) &
            (df['marketCap'] >= MIN_MARKET_CAP) & (df['marketCap'] <= MAX_MARKET_CAP) &
            (df['liquidity'] >= MIN_LIQUIDITY)
        )

        df_filtered = df[initial_filter].copy()

        # Ensure non-empty values in website, twitter, and telegram
        df_filtered = df_filtered[
            df_filtered['website'].notna() &
            df_filtered['twitter'].notna() &
            df_filtered['telegram'].notna()
        ]

        df_filtered.drop_duplicates(subset=['address'], inplace=True)

        if not df_filtered.empty:
            # Reorder columns to have 'createdDateTime' as the first column
            cols = ['createdDateTime'] + [col for col in df_filtered.columns if col != 'createdDateTime']
            df_filtered = df_filtered[cols]

            df_filtered.to_csv(csvPathToSave, index=False)
            print("Filtered DataFrame saved to:", csvPathToSave)
            return df_filtered
        else:
            print("No data found after filtering.")
            return None
    else:
        missing_columns = set(required_columns) - set(df.columns)
        print(f"One or more required columns are missing in the DataFrame: {missing_columns}")
        return None