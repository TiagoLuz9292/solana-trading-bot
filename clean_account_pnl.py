import pandas as pd

def remove_row_from_csv(file_path, address_value):
    # Read the CSV file into a DataFrame
    df = pd.read_csv(file_path)
    
    # Filter the DataFrame to exclude rows with the specified address value
    filtered_df = df[df['address'] != address_value]
    
    # Save the filtered DataFrame back to the CSV file
    filtered_df.to_csv(file_path, index=False)
    print(f"Rows with address '{address_value}' have been removed from {file_path}.")

# Usage example
file_path = 'data/open_trades.csv'  # Replace 'your_file.csv' with the path to your CSV file
address_value = 'E5MBirnq71DthjqwsAsgvCtgCAzShoWqnrzkmVQKviJc'  # Replace 'specific_address_value' with the address value you want to remove
remove_row_from_csv(file_path, address_value)