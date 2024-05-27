import { createClient } from 'redis';

const redisClient = createClient({
  url: 'redis://localhost:6379', // Ensure this matches your Redis server URL
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

export async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();

    console.log("Redis Connected.");
  }
}

export async function disconnectRedis() {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
}



export default redisClient;