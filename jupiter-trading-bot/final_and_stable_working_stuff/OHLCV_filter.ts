import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import axios from 'axios';
export { analyzeAndTrade };

interface Ohlcv {
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
}

interface TokenData {
    poolAddress: string;
    // add other relevant properties of your token data
}

function isUptrend(ohlcv: { open: number, close: number }): boolean {
    return ohlcv.close > ohlcv.open;
}

function isStable(ohlcv: { high: number, low: number }): boolean {
    const threshold = 0.10; // 10% threshold for volatility
    const range = ohlcv.high - ohlcv.low;
    const midpoint = (ohlcv.high + ohlcv.low) / 2;
    
    return (range / midpoint) <= threshold;
}


function hasSufficientVolume(ohlcv: { volume: number }, minVolume: number): boolean {
    return ohlcv.volume >= minVolume;
}


function hasPositiveMomentum(ohlcv: { close: number, open: number }): boolean {
    const minPriceChangePercentage = 10; // Minimum percentage change to consider
    const priceChangePercentage = ((ohlcv.close - ohlcv.open) / ohlcv.open) * 100;
    
    return priceChangePercentage >= minPriceChangePercentage;
}


async function analyzeAndTrade() {
    const filePath = "/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/OHLCV_filtered_list.csv";

    const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' });
    const records: TokenData[] = parse(fileContent, { columns: true, skip_empty_lines: true });
    const filteredRecords: TokenData[] = [];

    for (const record of records) {
        const ohlcvData = await fetchPoolData(record.poolAddress);
        if (ohlcvData.length >= 4) {
            const recentOhlcv = ohlcvData[ohlcvData.length - 1];
            if (isUptrend(recentOhlcv) &&
                isStable(recentOhlcv) &&
                hasSufficientVolume(recentOhlcv, 10000) && // Example volume threshold
                hasPositiveMomentum(recentOhlcv) &&
                hasVolumeIncreaseSequentially(ohlcvData, 50) && // Ensure this threshold makes sense for your strategy
                hasPriceIncreaseSequentially(ohlcvData)) {
                filteredRecords.push(record);
                // executeTrade(record.poolAddress); // Execute trade or further processing
            }
        }
    }

    const csvOutput = stringify(filteredRecords, { header: true });
    fs.writeFileSync('/home/tluz/project/ON-CHAIN-SOLANA-TRADING-BOT/data/OHLCV_filtered.csv', csvOutput, { encoding: 'utf-8' });
    console.log('Filtered records saved to OHLCV_filtered.csv');
}

function hasVolumeIncreaseSequentially(ohlcvData: Ohlcv[], minPercentageIncrease: number): boolean {
    if (ohlcvData.length < 4) {
        return false; // Need at least 4 data points to compare 3 sequential increases
    }

    let increaseCount = 0;

    for (let i = 1; i < ohlcvData.length; i++) {
        if (ohlcvData[i - 1].volume === 0) {
            continue; // Avoid division by zero and skip this iteration
        }

        const volumeIncrease = ((ohlcvData[i].volume - ohlcvData[i - 1].volume) / ohlcvData[i - 1].volume) * 100;
        if (volumeIncrease >= minPercentageIncrease) {
            increaseCount++;
        } else {
            increaseCount = 0; // Reset count if any volume decrease is found
        }

        // Check if we have 3 consecutive increases
        if (increaseCount >= 3) {
            return true;
        }
    }

    return false;
}



async function fetchPoolData(poolAddress: string): Promise<Ohlcv[]> {
    const url = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/ohlcv/minute?aggregate=5`;
    try {
        const response = await axios.get(url, { headers: { 'accept': 'application/json' } });
        const ohlcvList = response.data.data.attributes.ohlcv_list;
        return ohlcvList;
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error;
    }
}

interface Ohlcv {
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
}

function hasPriceIncreaseSequentially(ohlcvData: Ohlcv[]): boolean {
    if (ohlcvData.length < 4) {
        return false; // Need at least 4 data points to compare 3 sequential increases
    }

    // Start checking from the second element to compare it with the previous one
    for (let i = 1; i < ohlcvData.length; i++) {
        if (ohlcvData[i].close <= ohlcvData[i - 1].close) {
            return false; // If any candle's close is not higher than the previous one, return false
        }
    }

    return true; // If the loop completes without returning false, prices are sequentially increasing
}

// Call the function to execute it
//fetchPoolData();