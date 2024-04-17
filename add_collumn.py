import pandas as pd

def add_column_to_csv(csv_path):
    """
    Adds a new column 'token_amount_sold' between the columns 'message' and 'usd_spent' in a CSV file.

    Args:
    csv_path (str): Path to the CSV file.
    """
    # Load the CSV file into a DataFrame
    df = pd.read_csv(csv_path)

    # Check if 'message' and 'usd_spent' exists in the DataFrame
    if 'message' in df.columns and 'usd_spent' in df.columns:
        # Get the index of 'message' and add 1 to point to the next position
        index_of_message = df.columns.get_loc('message') + 1

        # Check if the next column is actually 'usd_spent'
        if df.columns[index_of_message] == 'usd_spent':
            # Insert the new column at the calculated position
            df.insert(loc=index_of_message, column='token_amount_sold', value=pd.NA)
        else:
            print(f"Column 'usd_spent' is not immediately after 'message'. Expected at index {index_of_message}, but found at index {df.columns.get_loc('usd_spent')}. No changes made.")
            return
    else:
        missing_columns = [col for col in ['message', 'usd_spent'] if col not in df.columns]
        print(f"Column(s) {', '.join(missing_columns)} not found in the CSV file. No changes made.")
        return

    # Write the updated DataFrame back to the CSV file
    df.to_csv(csv_path, index=False)
    print("Column 'token_amount_sold' added successfully.")

# Example usagecd ..
add_column_to_csv('data/sell_tracker_v2.csv')