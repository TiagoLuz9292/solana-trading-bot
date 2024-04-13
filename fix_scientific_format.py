import pandas as pd

# Define the path to your CSV file and the column to format
file_path = 'data/open_trades.csv'
column_name1 = 'entryPrice'  # Replace with the name of the column to format
column_name2 = 'TP_price_1'
column_name3 = 'TP_price_2'

# Read the CSV file into a DataFrame
df = pd.read_csv(file_path)

# Function to format non-empty and non-NaN cells
def format_price(x):
    if pd.notnull(x) and x != '':
        return f'{x:.9f}'
    return x

# Check if the column exists in the DataFrame
if column_name1 in df.columns:
    # Apply formatting only to non-empty and non-NaN cells
    df[column_name1] = df[column_name1].apply(format_price)

    # Save the modified DataFrame back to the CSV file
    df.to_csv(file_path, index=False)
    print(f'Column "{column_name1}" has been successfully formatted.')
else:
    print(f'Column "{column_name1}" not found in the file.')





if column_name2 in df.columns:
    # Apply formatting only to non-empty and non-NaN cells
    df[column_name2] = df[column_name2].apply(format_price)

    # Save the modified DataFrame back to the CSV file
    df.to_csv(file_path, index=False)
    print(f'Column "{column_name2}" has been successfully formatted.')
else:
    print(f'Column "{column_name2}" not found in the file.')





if column_name2 in df.columns:
    # Apply formatting only to non-empty and non-NaN cells
    df[column_name3] = df[column_name3].apply(format_price)

    # Save the modified DataFrame back to the CSV file
    df.to_csv(file_path, index=False)
    print(f'Column "{column_name3}" has been successfully formatted.')
else:
    print(f'Column "{column_name3}" not found in the file.')