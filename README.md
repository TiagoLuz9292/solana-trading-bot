

OHLCV checks update PLAN





















###################################################################################


YT link: https://www.youtube.com/watch?v=Q2kSA1Ns8oQ&list=PLXrNVMjRZUJjzGvQLXOKv2D-Pbfa0H_CH&index=4&ab_channel=MoonDev
watched until 2:51:18
This video shows how to use the premium birdeye API for token security and token creation GOLD info!


YT link: https://www.youtube.com/watch?v=Bp9yYqFyNCc&list=PLXrNVMjRZUJjzGvQLXOKv2D-Pbfa0H_CH&index=5&ab_channel=MoonDev
2:07:28 He is checking with GPT how to grab CA from messages on a TG channel
2:37:29 - about creating a system to get new tokens launch with hs spl program library
we want this TG group info for cas:  https://t.me/solanatokensnew


YT link: https://www.youtube.com/watch?v=f5HjboT1hNQ&list=PLXrNVMjRZUJjzGvQLXOKv2D-Pbfa0H_CH&index=6&ab_channel=MoonDev
17:30 - Setting up a server with python, and using nvidea graphic card and threading to acceleratio computing


YT link: https://www.youtube.com/watch?v=lN8yFuLaPBw&list=PLXrNVMjRZUJjzGvQLXOKv2D-Pbfa0H_CH&index=7&ab_channel=MoonDev
6:46 - implementing chatGPT vision to look at the website to get OLHCV, to see how the chart looks like

------------------------------------------------------------------------------------------------------------------------------

I have writen software in typecript, that can send swap transactions to buy or sell tokens on solana blockchain when triggered, and Im looking for a good strategy for when to buy and when to sell.


DONE
1. Im thinking about initially gathering data about 10k-15k solana tokens, that have market cap higher than 1k. Save those to a csv file called data/initial_list.csv with the addresses. Im going to grab that list from birdeye api because its the one who can give me a bigger list of tokens for free, dexscreener, dextools, geckoterminal, are not so good for that.
    script -> initial_list.py

DONE
2. Then another scan of the full list will be made using Dexscreener API and get the following details for each token, and then save them to a new csv file called token_overview_list.csv with the collumns for all the details:
    script -> #token_overview_list.py

Creation Date
Market Cap
Liquidity
Pool Address
Socials
    Twitter, Website, Telegram
Volume
    5m, 1h, 6h, 24h
Price change
    5m, 1h, 6h, 24h    
Buys/Sells
    5m, 1h, 6, 24h  


    ----> 2.1 Filter token_overview_list.csv and get only the tokens with at least 10 days into the file data/recent_tokens_list.csv

DONE
3. Then a filter will be done on the detail_list.csv to filter out the trash, based on the previous details, with max and min market cap, liquidity, volume, "if has all 3 socials" etc, and will save the filtered tokens in a csv file called level_1_filter.csv;
    script -> level_1_filter.py

4. Then the tokens on the level_1_filter.csv will be checked with the DexTools API to get the following autid info, holder count, and creation date, and filter out all the tokens who don't meet the requirements:
    script -> level_2_filter.py

isOpenSource
isHoneypot
isMintable
slippageModifiabl
isContractRenounced
isPotentiallyScam
Holders

The remaining tokens will be saved into a csv file called  level_2_filter.csv;

5. Now we should have a pretty decent list already with all the filters, and now we need the strategy with the conditions that will trigger the buy, and the sell.
The idea is to use the ability to obviously refresh the details about the level_2_filter.csv tokens, and as well check the OHLCV data of each one of them. 
The level_2_filter.csv should be the place where the bot will look for the entry points, but before getting the OHLCV for the tokens it should always do the refresh on the details because there might be some tokens that in the meanwhile were rugget, its price is like -90€ and the vollumne decreased drastically, and we want those out of the list, we are not trading rug pulls xD.

6. First I need a good strategy around the OHLCV, so that the bot can make trades potentially taking advantage of the volatility of the solana smaller tokens, and make just one automatic TP of 75%-80% of the amount that was bought, ans letting the rest ride for potential parabolic rise. Im not thinking about a stop loss, because the idea is to buy small, on tokens that have good details, and wait for like 75% - 100% profit on every trade.

7. The bot will scan the level_2_filter.csv list and as I said it will first refresh the details and do a level 1 filter, then will go through evey token on the list and for each one, grab the OHLCV data (on a timeframe to determine soon, thats one of the points i want to discuss again with you), check if all the conditions of the strategy are met, and if yes, execute the buy swap. Save the buy transaction and its details in a csv file called buy_tracker.csv, as like a buy journal.

8. A part of the program will be monitoring the buy tracker and add the bew buys into another csv file where it will manage the on-going trades, a file called open_trades.csv, and that is the part of the program that will be scanning the current price of the tokens, and that knows at which price or at which % of profit it should sell how much.

9. When the conditions for sell are met, sell the token and save the details of the sell transaction in a csv file called sell_tracker. Another part of the program will probably be monitoring that sell file in order to creat statistics with the trade results.

Based on everything I presented to you, I would like to hear from you, about a strategy I could apply with OHLCV data and calculations that we can make with it, and explain to me step by step, very clearly, what to look for, what calculations i will need on this strategy, and a list of final conditions that need to be met in order for a buy to occur


CHATGPT THANK YOU <3 :D

To develop a trading bot strategy using OHLCV (Open, High, Low, Close, Volume) data for tokens on the Solana blockchain, we would want to identify patterns and indicators that signal a good entry point for a buy and a subsequent point for a sell. Here’s a comprehensive strategy using OHLCV:

Strategy Overview:
Trend Identification:

Look for a consistent uptrend in a specific timeframe, for instance, where the close is higher than the open over a certain number of consecutive timeframes.
Volume Confirmation:

Volume should be increasing in the uptrend, which confirms the strength of the trend.
Volatility Measurement:

Volatility can be measured by looking at the range between high and low compared to the open and close. Narrow ranges on upward closes may indicate a steady uptrend.
Momentum Indicators:

You can calculate momentum indicators such as the Relative Strength Index (RSI) or Moving Average Convergence Divergence (MACD) from the OHLCV data.
Pullback Identification:

Look for pullbacks or small dips in an uptrend which are natural and healthy for continued momentum.
Liquidity Check:

Ensure there's enough liquidity in the pool to exit the position when required.
Profit Target and Sell Strategy:

Set a profit target for a partial sell (e.g., 75%-80%) and let the rest run with a trailing stop-loss to capitalize on any further upside.
Detailed Step-by-Step Conditions:
For Entry (Buy):

Uptrend Confirmation: Calculate the percentage difference between the close and open of the last ‘N’ 5-minute OHLCV bars. If the majority are positive, and the latest bar is significantly higher than the average, it indicates an uptrend.
Volume Increase: Ensure the volume of the latest bar is higher than the average volume of the last ‘N’ bars by a certain threshold.
Stability Check: The average range ((high - low) / (high + low)) of the last ‘N’ bars should be below a set threshold to ensure stability.
Momentum Confirmation: Use RSI or MACD calculated from the close prices of the OHLCV data to confirm buying pressure.
Pullback Opportunity: If the price is within a set percentage from the recent high, it could be a good entry after a pullback.
For Exit (Sell):

Initial Profit Target: If the price reaches 75%-80% above the buy price, sell a portion of the position.
Trailing Stop-Loss: Implement a trailing stop-loss which follows the price up and sells the rest if the price drops by a set percentage from the peak.
Refresh and Re-filter:

Periodically refresh token details from the level_2_filter.csv to check for any fundamental changes.
Re-apply Level 1 filter to ensure all tokens still meet the initial requirements.
Trade Execution:

When the entry conditions are met, execute a buy swap transaction, log the details in buy_tracker.csv.
Monitor open_trades.csv for ongoing trades, checking for sell conditions.
When the sell conditions are met, execute the sell swap and log it in sell_tracker.csv.
Risk Management:

Only invest a small percentage of the portfolio in any single trade.
Implement a maximum hold time for any position to avoid holding onto losers.
Backtesting:

Before going live, backtest your strategy using historical data to understand potential performance and tweak parameters accordingly.
Monitoring and Adjustment:

Continuously monitor the bot’s performance and adjust the strategy parameters as necessary based on market conditions.
Technical Implementation:
You will need to write functions in TypeScript that will process the OHLCV data and implement these strategy rules.
You will also need to handle API requests and responses, CSV file read/write operations, and error handling.
To manage state and periodic checks, use timers or cron jobs to initiate scans of level_2_filter.csv and execute trades.
Remember, while this strategy provides a guideline, it’s critical to factor in the unpredictability of markets, especially with less-established tokens which can be highly volatile and subject to manipulation. Always use risk management practices to mitigate potential losses.












4hnNazffpUU3MRTVk9tPhzYzXZgiSNMwM9V8e7KPJM4C69GhypcBSYuW7aqK8vDC  bug for this token



CryptoPulseTrading
SnipeCryptoLab
BlockSniperElite
CryptoSnipeNetwork
SnipeTradeHub
QuantumCryptoSnipe
SnipeSphereTraders
EliteCryptoTactics
SnipeVaultCrypto
CryptoSnipeVerse
SolSnipeX
SolanaSniperClub
MemeCoinMarksman
SolShotCrypto
SnipeSolTraders
SolanaSnipeStation
SnipeMemeElite
SolSniperGuild
CryptoSolShot
SolanaSnipeSphere


30541.91   -    3
9162.57


usd_received - ((token_amount_sold * usd_spent) / token_amount_received)



git token: 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



alias start-pnl='$trading_BOT/start-pnl.sh'
alias start-buyer='$trading_BOT/start-buyer.sh'
alias start-tg-balance='$trading_BOT/start-tg-balance.sh'
alias start-reload='$dex_BOT/start-reload.sh'
alias start-initial-list='$dex_BOT/start-initial-list.sh'
alias start-OHLCV-check='$dex_BOT/start-OHLCV-check.sh'



