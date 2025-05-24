import { createClient } from 'redis';

let redis = createClient(getRedisOptions());

function getRedisOptions() {
    const REDIS_OPTIONS = process.env.REDIS_OPTIONS;
    if (!REDIS_OPTIONS) throw new Error('Missing REDIS_OPTIONS');

    try {
        return JSON.parse(REDIS_OPTIONS);
    } catch (err) {
        throw new Error('Invalid REDIS_OPTIONS JSON');
    }
};

export const connectToRedis = async () => {
    redis.on('error', err => console.error('Redis Client Error', err));

    await redis.connect();
    await redis.flushAll();
    console.log('Redis client connected and flushed');
}

export default redis;

