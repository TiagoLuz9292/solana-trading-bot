import axios from "axios";

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

interface TokenTransfer {
    fromTokenAccount: string;
    toTokenAccount: string;
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
    tokenStandard: string;
}

async function waitForTransactionConfirmation(signature: string, tokenAddress: string, usdcMintAddress: string): Promise<{ tokenAmountReceived: number, usdcAmountSpent: number }> {
    console.log(`Waiting for transaction confirmation for signature: ${signature}`);
    let tokenAmountReceived: number = 0;
    let usdcAmountSpent: number = 0;
    let delayTime = 3000; // Starting delay of 3 seconds
    const maxDelay = 30000; // Maximum delay of 30 seconds
    const timeout = 120000; // Set timeout to 2 minutes
    const startTime = Date.now(); // Record the start time
    const apiKey = '718ea21d-2d9d-49e2-b3f2-46888e0fcb25'; // Helius API key
    const url = `https://api.helius.xyz/v0/transactions/?api-key=${apiKey}`;

    while (Date.now() - startTime < timeout) {
        try {
            console.log("ABOUT TO REQUEST FROM HELIUS");
            await delay(1000);
            const response = await axios.post(url, { transactions: [signature] }, { headers: { 'Content-Type': 'application/json' } });
            const transactions = response.data;
            if (transactions.length > 0) {
                const transaction = transactions[0];

                console.log("DEBUG: Transaction details received:", transaction);

                const tokenTransfers: TokenTransfer[] = transaction.tokenTransfers;
                const tokenTransfer = tokenTransfers.find(t => t.mint === tokenAddress);
                const usdcTransfer = tokenTransfers.find(t => t.mint === usdcMintAddress);

                if (tokenTransfer) {
                    tokenAmountReceived = tokenTransfer.tokenAmount;
                    console.log(`Token amount received: ${tokenAmountReceived}`);
                }

                if (usdcTransfer) {
                    usdcAmountSpent = usdcTransfer.tokenAmount;
                    console.log(`USDC amount spent: ${usdcAmountSpent}`);
                }

                if (tokenAmountReceived > 0 || usdcAmountSpent > 0) {
                    break; // Exit loop if either token amount or USDC amount is recorded
                }
            } else {
                console.log(`Transaction ${signature} not yet confirmed, checking again in ${delayTime / 1000} seconds...`);
                delayTime = Math.min(delayTime * 2, maxDelay); // Exponential back-off
                await delay(delayTime);
            }
        } catch (error) {
            console.error("Error fetching transaction details:", error);
            return { tokenAmountReceived, usdcAmountSpent };
        }
    }

    return { tokenAmountReceived, usdcAmountSpent };
}




(async () => {
    const tokenAddress = "4GvgzLeCMU2t8g4CZ1UxoyxBc6hotPRwdfeh2vxPpL89";
    const usdcMintAddress = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // Replace with actual USDC mint address
    const { tokenAmountReceived, usdcAmountSpent } = await waitForTransactionConfirmation("5nUo5QxQQxU6Vn58LthzJ7UCwpbtpfHAL1ECjNipckSyec7QH7XeiZ1SDAk5igCU4byj4P9FoCQiSfucTsacecXu", tokenAddress, usdcMintAddress);
    console.log(`DEBUG: Token amount received: ${tokenAmountReceived}, USDC spent: ${usdcAmountSpent}`);
})();