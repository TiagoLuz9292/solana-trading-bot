
/*
async function connectWebSocketWithRetry(url: string, maxRetries = 5): Promise<WebSocket> {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const ws = new WebSocket(url);
            await new Promise((resolve, reject) => {
                ws.on('open', resolve);
                ws.on('error', (err) => {
                  ws.close();
                  reject(err);
                });
            });
            return ws;
        } catch (error) {
            console.error(`WebSocket connection failed, retrying... ${error}`);
            retries++;
            await delay(1000 * Math.pow(2, retries)); // Exponential backoff
        }
    }
    throw new Error('Max retries reached for WebSocket connection');
  }
  
  
  
  interface WebSocketRetryItem {
    url: string;
    maxRetries: number;
    callback: () => void;  // Function to call on successful connection
  }
  
  
  const wsRetryQueue: WebSocketRetryItem[] = [];
  let isProcessingWsQueue = false;
  
  
  async function processWsQueue() {
    if (isProcessingWsQueue || wsRetryQueue.length === 0) return;
    isProcessingWsQueue = true;
  
    const nextItem = wsRetryQueue.shift();
    if (!nextItem) {
        console.error("Next item in WebSocket retry queue is undefined.");
        isProcessingWsQueue = false;
        return;
    }
    
    try {
      await connectWebSocketWithRetry(nextItem.url, nextItem.maxRetries);
      nextItem.callback();
    } finally {
      isProcessingWsQueue = false;
      if (wsRetryQueue.length > 0) {
          await delay(1000); // Delay to prevent rate limit issues
          processWsQueue();
      }
    }
  }
  
  function enqueueWsRetry(url: string, maxRetries: number, callback: () => void) {
    wsRetryQueue.push({ url, maxRetries, callback });
    if (!isProcessingWsQueue) {
      processWsQueue();
    }
  }
  
  
  async function subscribeToSellSignature(signature: string, token_amount: number, token_address: String, message: String, wallet: Keypair, telegramId: string) {
    let isTransactionConfirmed = false;
  
    try {
        const ws = await connectWebSocketWithRetry('wss://api.mainnet-beta.solana.com');
  
        if (!ws) {
            console.log("ws is undefined");
            return;
        }
  
        ws.on('open', () => {
            console.log('WebSocket connection opened.');
            const subscribeMessage = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "signatureSubscribe",
                "params": [
                    signature,
                    { "commitment": "finalized" }
                ]
            };
            ws.send(JSON.stringify(subscribeMessage));
            console.log('Subscription request sent:', subscribeMessage);
        });
  
        ws.on('message', (data: string) => {
            const response = JSON.parse(data);
            console.log('Received message:', response);
  
            if (response.method === 'signatureNotification') {
                if (response.params && response.params.result) {
                    const result = response.params.result;
                    if (result.value && result.value.err) {
                        console.error('Transaction failed with error:', result.value.err);
                        ws.close();
                    } else {
                        console.log('Transaction confirmed in slot:', result.context.slot);
                        isTransactionConfirmed = true;
                        fetchSellTransactionDetails(signature, token_amount, token_address, message, wallet, telegramId);
                        ws.close(); // Close the WebSocket connection once confirmed
                    }
                }
            }
        });
  
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            ws.close();
        });
  
        ws.on('close', () => {
            console.log('WebSocket connection closed.');
            if (!isTransactionConfirmed) {
                console.log("Connection closed before confirmation. Adding to retry queue...");
                enqueueWsRetry('wss://api.mainnet-beta.solana.com', 5, () => {
      subscribeToSellSignature(signature, token_amount, token_address, message, wallet, telegramId);
  });
            }
        });
    } catch (error) {
        console.error('Error subscribing to sell signature:', error);
    }
  }


  */