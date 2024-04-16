import pandas as pd
import numpy as np

def format_prices(file_path):
    # Load the CSV file into a DataFrame
    df = pd.read_csv(file_path)
    
    # List of columns to format
    columns_to_format = ['entryPrice', 'TP_price_1', 'TP_price_2']
    
    # Check if all required columns exist
    missing_columns = [col for col in columns_to_format if col not in df.columns]
    if missing_columns:
        print(f"Missing columns in the CSV: {missing_columns}")
        return

    # Apply formatting to each specified column
    for col in columns_to_format:
        # Replace NaN values with empty strings
        df[col] = df[col].replace(np.nan, '', regex=True)

        # Apply formatting only to non-empty cells
        df[col] = df[col].apply(lambda x: f"{float(x):.9f}" if x != '' else '')

    # Save the updated DataFrame back to CSV
    df.to_csv(file_path, index=False)
    print("Updated the prices to fixed decimal format.")

# Example usage
file_path = 'data/open_orders_v2.csv'
format_prices(file_path)