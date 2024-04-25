"""


 analyze_conditions() is the ENTRY POINT.


 The function * analyze_conditions() * acts as an https application, that receives requests from the typescript part of the code, 
 for the last check to decide if it enters the trade for that token or not.



"""


import time
import pandas as pd
import requests
from fastapi import FastAPI
from pydantic import BaseModel


#############################################################################################

#  These functions are not being used currently, maybe in the future

#############################################################################################

def calculate_rsi(data, period=14):
   
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

def is_stable(ohlcv_data, threshold=0.3):
    recent_bar = ohlcv_data.iloc[-1]  # Get the last row of the DataFrame
    range_ = recent_bar['high'] - recent_bar['low']
    midpoint = (recent_bar['high'] + recent_bar['low']) / 2

    return (range_ / midpoint) <= threshold

#-------------------------------------------------------------------------------------------------------------------------------------------------
#-------------------------------------------------------------------------------------------------------------------------------------------------

def is_pullback(ohlcv_data, pullback_percentage):
    # Assuming ohlcv_data is a DataFrame with 'close' as one of the columns
    recent_close = ohlcv_data['close'].iloc[-1]
    previous_close = ohlcv_data['close'].iloc[-2]

    pullback = (recent_close - previous_close) / previous_close

    return abs(pullback) <= pullback_percentage

#-------------------------------------------------------------------------------------------------------------------------------------------------

def has_sufficient_volume(ohlcv_data, min_volume):
    recent_volume = ohlcv_data.iloc[-1]['volume']
    print("has_sufficient_volume", recent_volume >= min_volume)
    return recent_volume >= min_volume    

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
# TESTING
#-------------------------------------------------------------------------------------------------------------------------------------------------
def check_moving_averages(ohlcv_data):
    print("Checking moving averages for DataFrame with rows:", len(ohlcv_data))
    
    if ohlcv_data.empty:
        print("DataFrame is empty.")
        return
    
    if 'close' not in ohlcv_data.columns:
        print("No 'close' column in DataFrame.")
        return
    
    # Calculate moving averages
    ohlcv_data['MA20'] = ohlcv_data['close'].rolling(window=20).mean()
    ohlcv_data['MA40'] = ohlcv_data['close'].rolling(window=40).mean()

    # Drop rows where MA40 is NaN
    ohlcv_data = ohlcv_data.dropna(subset=['MA40'])
    if ohlcv_data.empty:
        print("Not enough data to perform moving averages analysis after dropping NaN.")
        return

    # Drop rows where MA40 is NaN because we can't make comparisons for the first 39 rows
    ohlcv_data = ohlcv_data.dropna(subset=['MA40'])

    # Check conditions for the last row (most recent data)
    latest = ohlcv_data.iloc[-1]
    
    # Condition 1: Is the current close price above MA20?
    price_above_ma20 = latest['close'] > latest['MA20']
    print(f"Price above MA20: {price_above_ma20}")

    # Condition 2: Is the current close price above MA40?
    price_above_ma40 = latest['close'] > latest['MA40']
    print(f"Price above MA40: {price_above_ma40}")

    # Condition 3: Is MA20 above MA40?
    ma20_above_ma40 = latest['MA20'] > latest['MA40']
    print(f"MA20 above MA40: {ma20_above_ma40}")

    return (price_above_ma20 or price_above_ma40 or ma20_above_ma40)


#############################################################################################

#  Currently used functions for the checks

#############################################################################################

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

#############################################################################################

#  Application entry point, and ohlcv data fetch from GeckoTerminal API

#############################################################################################

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
    ohlcv_data_1m = fetch_pool_data(pairAddress, "minute", 1, 40)
    time.sleep(1)
    ohlcv_data_5m = fetch_pool_data(pairAddress, "minute", 5, 40)
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
        trade_quality = trade_quality + 2
    if (is_uptrend_1h):
        trade_quality = trade_quality + 1
    if (has_positive_momentum_5m):
        trade_quality = trade_quality + 3
    if (has_positive_momentum_15m):
        trade_quality = trade_quality + 2
    if (has_positive_momentum_1h):
        trade_quality = trade_quality + 1     


    print("\n***** Uptrend 5m: " + str(is_uptrend_5m))
    print("***** Uptrend 15m: " + str(is_uptrend_15m))
    print("***** Uptrend 1h: " + str(is_uptrend_1h))
    print("***** Price momentum 5m: " + str(has_positive_momentum_5m))
    print("***** Price momentum 15m: " + str(has_positive_momentum_15m))
    print("***** Price momentum 1h: " + str(has_positive_momentum_1h) + "\n") 
        
    

    print("")
    print("DEBUG: Doing checks with ma20 and ma40 1 MINUTE\n")
    ma_check_1m = check_moving_averages(ohlcv_data_1m)
   
    print("DEBUG: Doing checks with ma20 and ma40 5 MINUTE\n")
    ma_check_5m = check_moving_averages(ohlcv_data_5m)
    
    

    print("Trade quality: " + str(trade_quality))
    # If all conditions are met
    if (trade_quality >= 9 and (ma_check_1m or ma_check_5m)):
        return True
    else:
        return False


def test_ma(pairAddress):
    
    print("Request received for pairAddress:", pairAddress)
    
    # Define your time frame and number of frames you want to fetch
      # For example, 5 minutes
      # Last 10 frames
    
    # Fetch OHLCV data
    ohlcv_data_1m = fetch_pool_data(pairAddress, "minute", 1, 40)
    print("Data received for 1-minute frame:")
   
    time.sleep(1)
    ohlcv_data_5m = fetch_pool_data(pairAddress, "minute", 5, 40)
    print("Data received for 5-minute frame:")
    
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

    print("")
    print("DEBUG: Doing checks with ma20 and ma40 1 MINUTE\n")
    check_moving_averages(ohlcv_data_1m)
    print("DEBUG: Doing checks with ma20 and ma40 5 MINUTE\n")
    check_moving_averages(ohlcv_data_5m)

    

