import axios, { AxiosError } from 'axios';

const fastApiUrl = 'http://127.0.0.1:8000/check_ohlcv';

export async function checkOHLCVConditions(pairAddress: string): Promise<boolean> {
    try {
        await delay(2000);
        const response = await axios.post(fastApiUrl, { pairAddress: pairAddress });  // Ensure this matches the server's expected field
    
        return response.data;
    } catch (error) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
            console.error(`Error calling FastAPI service: ${axiosError.response.status}`);
        } else {
            console.error('Error calling FastAPI service:', axiosError.message);
        }
        return false;
    }
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//checkOHLCVConditions()