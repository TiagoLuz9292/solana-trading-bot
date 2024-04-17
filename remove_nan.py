import pandas as pd

def remove_record_by_address(csv_file, specific_address, output_csv):
    # Read the CSV file into a pandas dataframe
    df = pd.read_csv(csv_file)

    # Filter the dataframe to remove rows with the specific address
    df = df[df['address'] != specific_address]

    # Save the updated dataframe to a new CSV file
    df.to_csv(output_csv, index=False)

# Example usage:
remove_record_by_address('data/sell_tracker_v2.csv', 'CveCBpy6Hf5LjQXFz78vm4fTkwTV2fUHMtWwzpTzXke8', 'data/sell_tracker_v2.csv')