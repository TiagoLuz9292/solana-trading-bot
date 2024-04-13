import pandas as pd

def add_column_to_csv(csv_path):
    """
    Adds a new column 'amount_to_sell' right after the column 'TP_price_2' in a CSV file.

    Args:
    csv_path (str): Path to the CSV file.
    """
    # Load the CSV file into a DataFrame
    df = pd.read_csv(csv_path)

    # Check if 'TP_price_2' exists in the DataFrame
    if 'TP_price_2' in df.columns:
        # Get the index of 'TP_price_2' and add 1 to point to the next position
        index_of_TP_price_2 = df.columns.get_loc('TP_price_2') + 1
        
        # Insert the new column at the calculated position
        df.insert(loc=index_of_TP_price_2, column='amount_to_sell', value=pd.NA)
    else:
        print("Column 'TP_price_2' not found in the CSV file. No changes made.")
        return

    # Write the updated DataFrame back to the CSV file
    df.to_csv(csv_path, index=False)
    print("Column 'amount_to_sell' added successfully.")

# Example usage
add_column_to_csv('data/open_trades.csv')