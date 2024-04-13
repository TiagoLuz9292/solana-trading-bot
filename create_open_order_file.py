import csv

# Define the path for the new CSV file
csv_file_path = '/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/open_orders_v2.csv'

# Define the column headers
headers = ['tx_date', 'address', 'symbol', 'usd_spent', 'sol_spent', 'entryPrice', 'token_amount_received', 
           'TP_price_1', 'TP_price_2', 'TP_price_3', 'PNL', 'USD_value']

# Create and write headers to the CSV file
with open(csv_file_path, mode='w', newline='') as file:
    writer = csv.writer(file)
    writer.writerow(headers)

print(f"CSV file created at {csv_file_path} with headers only.")