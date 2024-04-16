import pandas as pd

def update_tp_price_2(file_path, address, new_tp_price):
    # Load the CSV file into a DataFrame
    df = pd.read_csv(file_path)
    
    # Check if the "address" and "TP_price_2" columns exist
    if 'address' not in df.columns or 'TP_price_2' not in df.columns:
        print("Required columns are missing in the CSV.")
        return
    
    # Find the row with the specified address and update the 'TP_price_2' column
    df.loc[df['address'] == address, 'TP_price_2'] = new_tp_price
    
    # Save the updated DataFrame back to CSV
    df.to_csv(file_path, index=False)
    print(f"Updated TP_price_2 for address {address} to {new_tp_price}.")

# Example usage
file_path = 'path/to/your/file.csv'
address = 'specific_address_value'
new_tp_price = 123.45  # example new price

update_tp_price_2("data/open_orders_v2.csv", "H2usNMctRyMQC2dfhiwHzdRNZiXKnbQLBWJR8T3578J2", "0.000067")