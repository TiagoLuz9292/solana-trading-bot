import pandas as pd
import OHLCV_filters



# Load data from CSV
def process_csv(file_path):
    # Read the CSV file into a DataFrame
    df = pd.read_csv(file_path)

    # Iterate through each row in the DataFrame
    for index, row in df.iterrows():
        # Grab the value from the 'pairAddress' column
        pair_address = row['pairAddress']

        # Send this value to the test_ma() function
        OHLCV_filters.test_ma(pair_address)

# Example usage:
file_path = '/root/project/solana-trading-bot/data/level_2_filter.csv'  # Update this to the path of your CSV file
process_csv(file_path)