import { update_wallet_balances } from './my_wallet';
import redisClient, { connectRedis, disconnectRedis } from './redisClient';

(async () => {
  try {

    console.log("test");

    
    await connectRedis();

    
    await update_wallet_balances();
    
    // Keep the process running to maintain WebSocket connections
    setInterval(() => {
      console.log('Heartbeat to keep the process alive');
    }, 60000); // Print a heartbeat message every 60 seconds

    // Clean up on exit
    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down gracefully...');
      await disconnectRedis();
      process.exit();
    });

    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      await disconnectRedis();
      process.exit();
    });

    

  } catch (error) {
    console.error('An error occurred:', error);
    await disconnectRedis();
    process.exit(1);
  }
})();

