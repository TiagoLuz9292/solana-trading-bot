import datetime
import pandas as pd

timestamp = datetime.datetime.now().strftime("%m-%d-%H")
csv_filtered_token_list_path = f'data/new_launches-{timestamp}.csv'

def get_new_launches():

    print("Getting data from data/bird_token_list.csv")

    data = pd.read_csv('data/bird_token_list.csv') 
    new_launches = data[data['v24hChangePercent'].isna()]  
    
    new_launches.to_csv(csv_filtered_token_list_path, index=False)

    pd.set_option('display.max_columns', None)
    print(new_launches)

    return new_launches
