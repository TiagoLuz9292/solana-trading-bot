import pandas as pd

# Define the path to your CSV file
file_path = 'data/open_trades.csv'

# Read the CSV file into a DataFrame
df = pd.read_csv(file_path)

# Check if the 'symbol' column exists
if 'symbol' in df.columns:
    # Move the 'symbol' column to be the third column
    # First, extract the symbol column
    symbol_col = df['symbol']
    # Drop the original symbol column
    df = df.drop('symbol', axis=1)
    # Insert the symbol column in the new position
    df.insert(2, 'symbol', symbol_col)
    
    # Save the modified DataFrame back to the CSV file
    df.to_csv(file_path, index=False)
    print('Column "symbol" has been successfully moved to the third position.')
else:
    print('Column "symbol" not found in the file.')