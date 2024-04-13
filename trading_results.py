import pandas as pd


def create_trading_results_file():

    # Define the paths to your CSV files
    file_path_1 = 'data/buy_tracker_final.csv'
    file_path_2 = 'data/sell_tracker_final.csv'

    # Read the CSV files into DataFrames
    df1 = pd.read_csv(file_path_1)
    df2 = pd.read_csv(file_path_2)

    # Merge the two DataFrames on the 'address' column
    merged_df = pd.merge(df1[['tx_date', 'address', 'symbol', 'usd_spent', 'sol_spent', 'entryPrice']],
                         df2[['date_time', 'address', 'token_amount_sold', 'sol_received', 'profit_in_usd']],
                         on='address',
                         how='inner')

    # Calculate 'exitPrice'
    merged_df['exitPrice'] = merged_df['profit_in_usd'] / merged_df['token_amount_sold']

    # Calculate 'usd_received' as 'profit_in_usd'
    merged_df['usd_received'] = merged_df['profit_in_usd']

    # Calculate 'result_sol' as 'usd_received' - 'usd_spent'
    merged_df['result_usd'] = merged_df['usd_received'] - merged_df['usd_spent']

    # Calculate 'result_usd' as 'sol_received' - 'sol_spent'
    merged_df['result_sol'] = merged_df['sol_received'] - merged_df['sol_spent']

    # Rename columns as specified
    merged_df.rename(columns={'tx_date': 'buy_date', 'date_time': 'sell_date'}, inplace=True)

    # Reorder the columns to match the required order
    final_df = merged_df[['buy_date', 'sell_date', 'address', 'symbol', 'entryPrice', 'exitPrice',
                          'usd_spent', 'sol_spent', 'usd_received', 'sol_received',
                          'result_sol', 'result_usd']]

    # Save the merged DataFrame to a new CSV file
    output_file_path = 'data/trading_results.csv'
    final_df.to_csv(output_file_path, index=False)

    print('The information has been successfully combined and saved to the new CSV file.')

def results_percentage():
    # Define the path to your CSV file and the names of the columns to check
    file_path = 'data/trading_results.csv'
    column_name = 'result_usd'  # The column to check for positive/negative values
    date_column = 'sell_date'  # The date column to filter by

    # Read the CSV file into a DataFrame
    df = pd.read_csv(file_path)

    # Filter the DataFrame by the specified dates, ignoring time
    df_filtered = df[df[date_column].str.contains('11-04-2024', na=False)]

    # Check if the column exists in the DataFrame
    if column_name in df_filtered.columns:
        # Count the number of positive and negative values
        positive_count = df_filtered[df_filtered[column_name] > 0].shape[0]
        negative_count = df_filtered[df_filtered[column_name] < 0].shape[0]
        total_count = df_filtered.shape[0]

        # Calculate the percentages
        if total_count > 0:
            positive_percentage = (positive_count / total_count) * 100
            negative_percentage = (negative_count / total_count) * 100

            print(f'Percentage of positive values in "{column_name}" on 10-04-2024 and 11-04-2024: {positive_percentage:.2f}%')
            print(f'Percentage of negative values in "{column_name}" on 10-04-2024 and 11-04-2024: {negative_percentage:.2f}%')
        else:
            print('No data to analyze in the specified column for the given dates.')
    else:
        print(f'Column "{column_name}" not found in the file.')    

def sum_column_values():
    file_path = 'data/trading_results.csv'  # Replace with the actual path to your CSV file
    column_name = 'result_usd'  # Column to sum
    date_column = 'sell_date'  # Column to check the date
    target_date = '11-04-2024'  # Target date to filter by

    try:
        # Read the CSV file into a DataFrame
        df = pd.read_csv(file_path)

        # Check if the necessary columns exist in the DataFrame
        if column_name in df.columns and date_column in df.columns:
            # Filter the DataFrame for rows where the date_column has the target_date
            filtered_df = df[df[date_column].str.contains(target_date, na=False)]

            # Sum the values in the specified column of the filtered DataFrame
            total_sum = filtered_df[column_name].sum()
            print(f'The total sum of "{column_name}" on {target_date} is: {total_sum}')
            return total_sum
        else:
            print(f'One or both specified columns "{column_name}" and "{date_column}" not found in the file.')
            return None
    except Exception as e:
        print(f'An error occurred: {e}')
        return None

def remove_duplicates():
    file_path = 'data/trading_results.csv'  # Replace with the actual path to your CSV file
    column_name = 'address'  # Replace with the actual column name to check for duplicates
    """
    Remove duplicate rows based on a specific column and save the unique rows back to the CSV.

    :param file_path: The path to the CSV file.
    :param column_name: The name of the column to check for duplicates.
    """
    try:
        # Read the CSV file into a DataFrame
        df = pd.read_csv(file_path)

        # Check if the column exists in the DataFrame
        if column_name in df.columns:
            # Remove duplicates, keeping the first occurrence
            unique_df = df.drop_duplicates(subset=[column_name], keep='first')

            # Save the DataFrame with duplicates removed back to the CSV file
            unique_df.to_csv(file_path, index=False)
            print(f'Duplicates removed based on column "{column_name}".')
        else:
            print(f'Column "{column_name}" not found in the file.')
    except Exception as e:
        print(f'An error occurred: {e}')

# Example usage

#remove_duplicates()

sum_column_values()

results_percentage()

#create_trading_results_file()