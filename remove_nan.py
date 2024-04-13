import csv

def clear_csv_data(file_path):
    # Read the headers from the CSV file
    with open(file_path, mode='r', newline='') as file:
        reader = csv.reader(file)
        headers = next(reader, None)  # Read the first line and use as headers

    # Check if headers were found
    if headers:
        # Write only the headers back to the CSV file
        with open(file_path, mode='w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(headers)
        print("CSV file has been cleared except for the column headers.")
    else:
        print("No data found in the CSV file.")

# Specify the path to your CSV file
file_path = 'data/open_orders_v2.csv'
clear_csv_data(file_path)