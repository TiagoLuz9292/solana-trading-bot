I built a solana sniper bot that buys and sells solana tokens automatically depending on some set variables. I want you to help me to figure out a good strategy that i can use with the functionality that my bot has, so im going to explain a little bit how it works so that you can have more context to help:

The bot initially grabs between a list of 300-500 token address from dextools, and that list has the tokens that were launched in the last 2-3 hours.

Then I grab the overview information for all those tokens from Dexscreener, and these are the information I get for all of them:

'createdDateTime',
'address', 
'h1Buys', 
'h1Sells', 
'24hBuys', 
'24hSells', 
'v24h', 
'v1h', 
'1hPriceChange', 
'6hPriceChange', 
'24hPriceChange', 
'liquidity', 
'marketCap', 
'priceUSD', 
'website', 
'twitter', 
'telegram'

Then, the bot filters those tokens by the values I set to each of those parameters, and I get a smaller filtered list;

Then For all of the remaining filtered tokens, I get the audit info from dextools:

isOpenSource
isHoneypot'
isMintable'
slippageModifiable'
isContractRenounced'
isPotentiallyScam'

After checking if all the wanted values for those variables are met, it filters a gets an even smaller list

Then for the remaining tokens after all those filters, It checks the holders could for them and can filter for some specific amount of holders.

After that, we have the final toke list.

Then my program will go each of the tokens in the final list, and for each one checks the wallet balance, if the wallet doesnt have that token yet, it sends a swap transaction to the blockchain with jupiter API and buys a specific set amount with solana, given the amount in USD.

Each time it sends a buy transaction, it adds a line to a transactions file and sets a collumn called "tx_state" to "Pending", and calculates the entryPrice considering the usd amount spent and the amount of tokens received;

Simultaniously there is another component that is continuously checking if the tokens on that list are in the wallet, if yes, the tx_state collumn is set from "Pending" to "Complete". if some tokens remain in Pending status for some time, it will remove those lines as the transaction didnt succeed.

Simultaniously there is another component that is continuously checking for the token address on the transactions file, calculating for all of them the current price, and based on the entryPrice, it calculates the current percentage of profit and loss and keeping that info on another file called Account_PNL on a collumn called "PNL";

Simultaniously there is another component that is continuously checking for the token address on the Account_PNL file searching for a value on the "PNL" collumn that is higher than a set value, which is the value that indicates we should sell a set percentage of the token holdings. For example, the set take profit is when tokens are in 300% in profit, if it sees a token with PNL higher than 300%, it sells a set portion.

Now, I want you to help me, considering all the filter parameters that are currently available in my program, that I described above, help me figuring out a good strategy regarding the filter values I should use, considering the tokens are at the max 3h old, and with that strategy, at with % i should sell what % of the token holdings, also considering im not thinking about having a stop loss, this means that when I buy a token, either it goes to profit, or it goes to 0.


CHAT GPT

Creating a successful trading strategy for a sniper bot in the cryptocurrency market, particularly for newly launched tokens, involves balancing risk and reward while leveraging the available data. Here’s a strategy considering the functionalities and data points you have:

1. Filtering Tokens
Liquidity: Look for tokens with a minimum liquidity threshold to ensure there’s enough market activity for entering and exiting trades. For newly launched tokens, a liquidity of at least $50,000 to $100,000 could be a good starting point.
Volume: Consider tokens with high trading volume relative to their liquidity, as this indicates active trading interest. For instance, a 24-hour volume that is at least 50% of the liquidity.
Price Change: Target tokens showing positive momentum. For example, a 1-hour price change greater than 10% could indicate growing interest.
Market Cap: Be cautious with extremely high or low market caps. A very low market cap could indicate potential for growth but also higher risk, while a very high market cap immediately after launch could signal overvaluation.
Audit Info: Prefer tokens that are open source, not identified as honeypots, not mintable, have no modifiable slippage, have renounced contracts, and are not potentially scam.
Holders Count: A higher number of holders can indicate a distributed interest in the token. Filter for tokens with more than a certain number of holders, for example, 100+.
2. Buy Strategy
Entry Point: Buy tokens that pass all the above filters. Set an amount you are comfortable risking per token, considering the volatile nature of new launches.
Diversification: Spread your investment across multiple tokens to reduce the risk of total loss.
3. Sell Strategy
Profit Taking: Since you prefer not to set a stop loss, focus on profit taking. For instance, if a token reaches 300% profit, sell a certain percentage of your holding, such as 50% to 75%. This allows you to capture profits while still having exposure to potential further upside.
Re-evaluation: For tokens that increase in value, continuously monitor and consider selling additional portions at higher profit levels (e.g., 500%, 700%).
No Stop Loss: In the absence of a stop loss, regularly review tokens that are not performing or are continuously declining to decide whether to hold or manually cut losses to free up capital for other opportunities.
4. Monitoring and Adjustments
Regularly monitor the market for changes in trends or behaviors, especially in the fast-paced environment of new token launches.
Be prepared to adjust the parameters and strategy based on market conditions, the success rate of the trades, and emerging trends in the DeFi space.
5. Risk Management
Invest only what you can afford to lose, especially in the high-risk environment of newly launched tokens.
Keep updating your knowledge about the DeFi space, as new factors and trends can quickly change the optimal strategy.
This strategy balances the need for rigorous filtering to reduce the risk of scams and the desire to capture significant gains from new tokens. Regularly backtest and review the performance of your bot with these strategies and adjust as necessary to optimize its performance.