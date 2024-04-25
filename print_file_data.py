import pandas as pd
from tabulate import tabulate
import sys

def pretty_print_csv(csv_file_path):
    # Read the CSV file into a DataFrame
    df = pd.read_csv(csv_file_path)

    # Set the pandas option to display float format with 9 decimal places
    pd.options.display.float_format = '{:,.9f}'.format
    
    # Convert columns to float if they're not already and format
    float_columns = ['entryPrice', 'TP_price_1', 'TP_price_2', 'TP_price_3']
    for col in float_columns:
        if col in df.columns:
            df[col] = df[col].astype(float).map('{:,.9f}'.format)
    
    # Print the DataFrame using the tabulate library to make it pretty
    print(tabulate(df, headers='keys', tablefmt='psql', showindex=False))

# Check if a command-line argument is provided
if len(sys.argv) > 1:
    arg = sys.argv[1]  # Take the first argument as the CSV file path
    if arg == "open-orders":
        pretty_print_csv('/root/project/solana-trading-bot/data/open_orders_v2.csv')
    elif arg == "sells":
        pretty_print_csv('/root/project/solana-trading-bot/data/sell_tracker_v2.csv')
    elif arg == "buys":
        pretty_print_csv('/root/project/solana-trading-bot/data/open_orders_v2_inbound.csv')    

# Call the function with the path to your CSV file
