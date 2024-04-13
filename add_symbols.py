import token_overview_list
import pandas as pd
import requests
import pprint



def update_symbols_in_csv(file_path):
    # Load the CSV file into a DataFrame
    df = pd.read_csv(file_path)

    # Ensure there is a 'symbol' column
    if 'symbol' not in df.columns:
        df['symbol'] = ''

    # Update the 'symbol' column for each record
    for index, row in df.iterrows():
        token_data = token_overview_list.get_token_overview_for_token(row['address'])
        if token_data is not None:
            df.at[index, 'symbol'] = token_data['symbol'].values[0]

    # Save the modified DataFrame back to the CSV file
    df.to_csv(file_path, index=False)

# Specify the path to your CSV file
file_path = 'data/open_trades.csv'
update_symbols_in_csv(file_path)

