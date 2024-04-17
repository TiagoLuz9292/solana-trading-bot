import pandas as pd

def update_record_by_address(csv_file, specific_address, new_result_usd, output_csv):
    # Read the CSV file into a pandas dataframe
    df = pd.read_csv(csv_file)

    # Update the value in the "result_usd" column for the specific address
    df.loc[df['address'] == specific_address, 'result_usd'] = new_result_usd

    # Save the updated dataframe to a new CSV file
    df.to_csv(output_csv, index=False)

# Example usage:
update_record_by_address('data/sell_tracker_v2.csv', '4TECfrYNQiZb8pBwJWLLGz7GFT7ozocGo2UL93nx6YrN', 0.1729, 'data/sell_tracker_v2.csv')