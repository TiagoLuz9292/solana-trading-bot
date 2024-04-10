import time
import pandas as pd
import requests
from fastapi import FastAPI
from pydantic import BaseModel

def calculate_rsi(data, period=14):
    """
    Calculate the Relative Strength Index (RSI) for a given pandas DataFrame.
    
    :param data: pandas DataFrame with 'close' column containing closing prices
    :param period: The period over which to calculate RSI (typically 14)
    :return: pandas DataFrame with 'RSI' column
    """
    delta = data['close'].diff()
    gain = ((delta + delta.abs()) / 2).fillna(0)
    loss = ((delta - delta.abs()) / 2).abs().fillna(0)

    avg_gain = gain.rolling(window=period).mean()
    avg_loss = loss.rolling(window=period).mean()

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    
    data['RSI'] = rsi
    return data

#-------------------------------------------------------------------------------------------------------------------------------------------------

def calculate_macd(data, n_fast=12, n_slow=26, n_signal=9):
    """
    Calculate the Moving Average Convergence Divergence (MACD) for a pandas DataFrame.
    
    :param data: pandas DataFrame with 'close' column containing closing prices
    :param n_fast: The short-term period for the exponential moving average (typically 12)
    :param n_slow: The long-term period for the exponential moving average (typically 26)
    :param n_signal: The signal line period for the exponential moving average (typically 9)
    :return: pandas DataFrame with 'MACD', 'Signal' and 'Hist' (MACD Histogram) columns
    """
    exp1 = data['close'].ewm(span=n_fast, adjust=False).mean()
    exp2 = data['close'].ewm(span=n_slow, adjust=False).mean()
    macd = exp1 - exp2
    signal = macd.ewm(span=n_signal, adjust=False).mean()
    hist = macd - signal
    
    data['MACD'] = macd
    data['Signal'] = signal
    data['Hist'] = hist
    return data

app = FastAPI()

class TokenData(BaseModel):
    address: str
    # Add other necessary fields



#-------------------------------------------------------------------------------------------------------------------------------------------------
#-------------------------------------------------------------------------------------------------------------------------------------------------

def is_pullback(ohlcv_data, pullback_percentage):
    # Assuming ohlcv_data is a DataFrame with 'close' as one of the columns
    recent_close = ohlcv_data['close'].iloc[-1]
    previous_close = ohlcv_data['close'].iloc[-2]

    pullback = (recent_close - previous_close) / previous_close

    return abs(pullback) <= pullback_percentage

#-------------------------------------------------------------------------------------------------------------------------------------------------
#-------------------------------------------------------------------------------------------------------------------------------------------------

def is_uptrend(ohlcv_data, periods, bullish_percentage=0.62):
    data_length = len(ohlcv_data)
    
    # Calculate the number of periods to consider based on the data available
    periods = min(periods, data_length)
    
    # Get the most recent 'periods' candles from the start
    recent_data = ohlcv_data.head(periods)
    
    # Count the number of bullish candles in the period
    bullish_count = (recent_data['close'] > recent_data['open']).sum()
    
    # Calculate the percentage of bullish candles
    bullish_ratio = bullish_count / periods

    print(f"In the last {periods} periods, {bullish_count} bullish, {periods - bullish_count} bearish")
    # Check if the bullish ratio meets or exceeds the required bullish percentage
    return bullish_ratio >= bullish_percentage

#-------------------------------------------------------------------------------------------------------------------------------------------------
#-------------------------------------------------------------------------------------------------------------------------------------------------

def is_stable(ohlcv_data, threshold=0.3):
    recent_bar = ohlcv_data.iloc[-1]  # Get the last row of the DataFrame
    range_ = recent_bar['high'] - recent_bar['low']
    midpoint = (recent_bar['high'] + recent_bar['low']) / 2

    return (range_ / midpoint) <= threshold

#-------------------------------------------------------------------------------------------------------------------------------------------------
#-------------------------------------------------------------------------------------------------------------------------------------------------

def has_sufficient_volume(ohlcv_data, min_volume):
    recent_volume = ohlcv_data.iloc[-1]['volume']
    print("has_sufficient_volume", recent_volume >= min_volume)
    return recent_volume >= min_volume

#-------------------------------------------------------------------------------------------------------------------------------------------------
#-------------------------------------------------------------------------------------------------------------------------------------------------

def has_bullish_engulfing(ohlcv_data):
    if len(ohlcv_data) < 2:
        return False

    # Get the last two candles
    previous_ohlcv = ohlcv_data.iloc[-2]
    recent_ohlcv = ohlcv_data.iloc[-1]

    # Conditions for a bullish engulfing pattern
    is_previous_red = previous_ohlcv['close'] < previous_ohlcv['open']
    is_recent_green = recent_ohlcv['close'] > recent_ohlcv['open']
    is_engulfing = (recent_ohlcv['open'] < previous_ohlcv['close']) and (recent_ohlcv['close'] > previous_ohlcv['open'])

    return is_previous_red and is_recent_green and is_engulfing

#-------------------------------------------------------------------------------------------------------------------------------------------------
#-------------------------------------------------------------------------------------------------------------------------------------------------

def has_positive_momentum(ohlcv_data, periods, min_avg_price_change_percentage=5):
    if len(ohlcv_data) < periods:
        return False  # Not enough data to analyze

    # Calculate the price change percentage for the last 'periods' frames
    recent_data = ohlcv_data.head(periods)
    price_changes_for_periods = (recent_data['close'] - recent_data['open']) / recent_data['open'] * 100
    
    # Calculate the average price change percentage for the last 'periods' frames
    avg_price_change_for_periods = price_changes_for_periods.mean()
    print("Average price change for periods:", avg_price_change_for_periods)

    # Calculate the price change percentage for the last 2 frames
    last_two_frames = ohlcv_data.head(2)
    price_changes_for_last_two = (last_two_frames['close'] - last_two_frames['open']) / last_two_frames['open'] * 100
    
    # Calculate the average price change percentage for the last 2 frames
    avg_price_change_for_last_two = price_changes_for_last_two.mean()
    print("Average price change for last two frames:", avg_price_change_for_last_two)

    # Compare the two averages and check against the minimum threshold
    is_positive_momentum = avg_price_change_for_last_two > avg_price_change_for_periods and avg_price_change_for_last_two >= 0
    return is_positive_momentum

#-------------------------------------------------------------------------------------------------------------------------------------------------
#-------------------------------------------------------------------------------------------------------------------------------------------------

def is_increasing_volume(ohlcv_data, threshold=0.20, periods=12):
    if len(ohlcv_data) < periods + 1:
        return False

    # Calculate the average volume of the last 'periods' periods
    average_volume = ohlcv_data['volume'].iloc[-periods-1:-1].mean()
    recent_volume = ohlcv_data['volume'].iloc[-1]

    volume_increase = (recent_volume - average_volume) / average_volume if average_volume != 0 else 0

    return volume_increase > threshold

#-------------------------------------------------------------------------------------------------------------------------------------------------
#-------------------------------------------------------------------------------------------------------------------------------------------------

def fetch_pool_data(poolAddress, minuteOrHour, timeFrame, frameAmount):
    url = f"https://api.geckoterminal.com/api/v2/networks/solana/pools/{poolAddress}/ohlcv/{minuteOrHour}?aggregate={timeFrame}&limit={frameAmount}"
    max_retries = 5
    retry_delay = 10  # start with 10 seconds delay

    for i in range(max_retries):
        try:
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
            ohlcv_list = data['data']['attributes']['ohlcv_list']
            # Create the DataFrame without rounding the values
            ohlcv_data = pd.DataFrame(ohlcv_list, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            #print(ohlcv_data)
            # Display the DataFrame with full precision
            pd.set_option('display.float_format', '{:.15f}'.format)
            
            return ohlcv_data
        except requests.exceptions.HTTPError as e:
            if response.status_code == 429:  # Too Many Requests
                print(f"Rate limit exceeded. Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                raise e
    raise Exception(f"Failed to fetch data after {max_retries} attempts.")


from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class PoolAddress(BaseModel):
    pairAddress: str

@app.post("/check_ohlcv")
def analyze_conditions(data: PoolAddress):
    pairAddress = data.pairAddress
    print("Request received for pairAddress:", pairAddress)
    
    # Define your time frame and number of frames you want to fetch
      # For example, 5 minutes
      # Last 10 frames
    
    # Fetch OHLCV data
    ohlcv_data_5m = fetch_pool_data(pairAddress, "minute", 5, 10)
    time.sleep(1)
    ohlcv_data_15m = fetch_pool_data(pairAddress, "minute", 15, 5)
    time.sleep(1)
    ohlcv_data_1h = fetch_pool_data(pairAddress, "hour", 1, 3)
    time.sleep(1)
    
    is_uptrend_5m = is_uptrend(ohlcv_data_5m, 10)
    is_uptrend_15m = is_uptrend(ohlcv_data_15m, 5)
    is_uptrend_1h = is_uptrend(ohlcv_data_1h, 3)

    has_positive_momentum_5m = has_positive_momentum(ohlcv_data_5m, 10)
    has_positive_momentum_15m = has_positive_momentum(ohlcv_data_15m, 5)
    has_positive_momentum_1h = has_positive_momentum(ohlcv_data_1h, 3)

    trade_quality = 0


    if (is_uptrend_5m):
        trade_quality = trade_quality + 3
    if (is_uptrend_15m):
        trade_quality = trade_quality + 3
    if (is_uptrend_1h):
        trade_quality = trade_quality + 2
    if (has_positive_momentum_5m):
        trade_quality = trade_quality + 3
    if (has_positive_momentum_15m):
        trade_quality = trade_quality + 3
    if (has_positive_momentum_1h):
        trade_quality = trade_quality + 2     


    print("\n***** Uptrend 5m: " + str(is_uptrend_5m))
    print("***** Uptrend 15m: " + str(is_uptrend_15m))
    print("***** Uptrend 1h: " + str(is_uptrend_1h))
    print("***** Price momentum 5m: " + str(has_positive_momentum_5m))
    print("***** Price momentum 15m: " + str(has_positive_momentum_15m))
    print("***** Price momentum 1h: " + str(has_positive_momentum_1h) + "\n") 
        
    print("Trade quality: " + str(trade_quality))

    # If all conditions are met
    if (trade_quality >= 11):
        return True
    else:
        return False
    

#-------------------------------------------------------------------------------------------------------------------------------------------------
#-------------------------------------------------------------------------------------------------------------------------------------------------

def analyze_and_trade_5m():
    src_file_path = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/hyper_filtered_dextools_FINAL.csv"
    df = pd.read_csv(src_file_path)
    filtered_records = []

    for _, record in df.iterrows():
        ohlcv_data = fetch_pool_data(record['poolAddress'], 5)
        print(f"Results for {record['poolAddress']} on 5 min timeframe")
        if len(ohlcv_data) >= 4:
            recent_ohlcv = ohlcv_data[-1]
            if (is_uptrend(recent_ohlcv) and
                is_stable(recent_ohlcv) and
                has_sufficient_volume(recent_ohlcv, 1000) and
                has_positive_momentum(recent_ohlcv)):
               
                filtered_records.append(record)

    filtered_df = pd.DataFrame(filtered_records)
    filtered_df.to_csv('/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/OHLCV_5m_filtered.csv', index=False)
    print('Filtered records saved to OHLCV_filtered.csv')

#-------------------------------------------------------------------------------------------------------------------------------------------------
#-------------------------------------------------------------------------------------------------------------------------------------------------

def analyze_and_trade_1m():
    src_file_path = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/hyper_filtered_dextools_FINAL.csv"
    df = pd.read_csv(src_file_path)
    filtered_records = []

    for _, record in df.iterrows():
        ohlcv_data = fetch_pool_data(record['poolAddress'], 1)
        print(f"Results for {record['poolAddress']} on 1 min timeframe")
        if len(ohlcv_data) >= 4:
            recent_ohlcv = ohlcv_data[-1]
            if (is_uptrend(recent_ohlcv) and
                is_stable(recent_ohlcv) and
                has_sufficient_volume(recent_ohlcv, 200) and
                has_positive_momentum(recent_ohlcv)):
             
                filtered_records.append(record)

    filtered_df = pd.DataFrame(filtered_records)
    filtered_df.to_csv('/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/OHLCV_1m_filtered.csv', index=False)
    print('Filtered records saved to OHLCV_filtered.csv')

#-------------------------------------------------------------------------------------------------------------------------------------------------
#-------------------------------------------------------------------------------------------------------------------------------------------------

def analyze_and_trade_test_1m(poolAddress):
    ohlcv_data = fetch_pool_data(poolAddress)
    if len(ohlcv_data) >= 4:
        recent_ohlcv = ohlcv_data[-1]
        
        # All these functions should work with 'recent_ohlcv' because they only need the last record to work
        uptrend_result = is_uptrend(recent_ohlcv)
        stable_result = is_stable(recent_ohlcv)
        sufficient_volume_result = has_sufficient_volume(recent_ohlcv, 10000)
        positive_momentum_result = has_positive_momentum(recent_ohlcv)
        
        # These functions need the full ohlcv_data list
    

        if (uptrend_result and stable_result and sufficient_volume_result and positive_momentum_result):
            print("OHLCV result is True")
        else:
            print("OHLCV result is False")

         
#fetch_pool_data("Cr7z6x8zuV3xLmuLj5bMNhnRB7FoCg88mKNL6BcxknW1", 15, 2)

#analyze_and_trade_test("9YZVgXphk7Go1siP7AUr5csC36bgDyCob3ktdfyne1g3")
