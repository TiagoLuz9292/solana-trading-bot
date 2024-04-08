import csv

input_file = 'data/sell_tracker_final.csv'
output_file = 'data/sell_tracker_final.csv'

rows_to_keep = []

with open(input_file, 'r', newline='') as csvfile:
    reader = csv.reader(csvfile)
    for row in reader:
        # Check if the row has enough columns and the 'profit_in_usd' column is not empty
        if len(row) > 4 and row[4].strip():  # Assuming 'profit_in_usd' is the 5th column (index 4)
            rows_to_keep.append(row)

with open(output_file, 'w', newline='') as csvfile:
    writer = csv.writer(csvfile)
    writer.writerows(rows_to_keep)

print(f"Filtered data written to {output_file}")