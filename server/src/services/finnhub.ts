import { CacheService } from './cache';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const FINNHUB_BASE_URL = process.env.FINNHUB_BASE_URL || 'https://finnhub.io/api/v1';

// Token Bucket for rate limiting
class TokenBucket {
    private tokens: number;
    private maxTokens: number;
    private refillRateMs: number;
    private lastRefill: number;

    constructor(maxTokens: number, refillRateMs: number) {
        this.maxTokens = maxTokens;
        this.tokens = maxTokens;
        this.refillRateMs = refillRateMs;
        this.lastRefill = Date.now();
    }

    private refill() {
        const now = Date.now();
        const timePassed = now - this.lastRefill;
        if (timePassed > this.refillRateMs) {
            this.tokens = this.maxTokens;
            this.lastRefill = now;
        }
    }

    async consume(): Promise<void> {
        return new Promise((resolve) => {
            const check = () => {
                this.refill();
                if (this.tokens > 0) {
                    this.tokens -= 1;
                    resolve();
                } else {
                    const timeToWait = this.refillRateMs - (Date.now() - this.lastRefill);
                    setTimeout(check, timeToWait > 0 ? timeToWait : 100);
                }
            };
            check();
        });
    }
}

// 55 max per minute (Finnhub Free Tier limit)
const minuteBucket = new TokenBucket(55, 60000);
// 10 max per second (Burst limit)
const secondBucket = new TokenBucket(10, 1000);

// Request Coalescing (prevent duplicate concurrent requests)
const inFlight = new Map<string, Promise<any>>();

async function fetchWithRateLimit(url: string, cacheKey: string, ttlSeconds: number): Promise<any> {
    // 1. Check in-flight
    if (inFlight.has(cacheKey)) {
        return inFlight.get(cacheKey);
    }

    const promise = (async () => {
        try {
            // 2. Check Cache
            const cached = await CacheService.getCacheConfig(cacheKey);
            if (cached && !cached.isStale) {
                return JSON.parse(cached.payloadJson);
            }

            // 3. Rate Limit Wait (must pass both buckets to proceed)
            await minuteBucket.consume();
            await secondBucket.consume();

            // 4. Fetch
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Rate limit exceeded from Finnhub');
                }
                throw new Error(`Finnhub error: ${response.status}`);
            }

            const data = await response.json();

            // 5. Set Cache
            await CacheService.setCacheConfig(cacheKey, JSON.stringify(data), ttlSeconds, 'FINNHUB');

            return data;
        } catch (error) {
            // Fallback to cache marked as stale
            const cached = await CacheService.getCacheConfig(cacheKey);
            if (cached) {
                return JSON.parse(cached.payloadJson);
            }
            throw error;
        } finally {
            inFlight.delete(cacheKey);
        }
    })();

    inFlight.set(cacheKey, promise);
    return promise;
}

export class FinnhubService {
    static async getQuote(symbol: string) {
        const url = `${FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
        return fetchWithRateLimit(url, `quote:${symbol}`, 30); // 30 seconds
    }

    static async getCandles(symbol: string, resolution: string, from: number, to: number) {
        // Finnhub Free tier is arbitrarily blocking /stock/candle (403). We bypass it entirely using yahoo-finance2.
        try {
            const cacheKey = `candle:yf:${symbol}:${resolution}:${from}:${to}`;
            const cached = await CacheService.getCacheConfig(cacheKey);
            if (cached && !cached.isStale) return JSON.parse(cached.payloadJson);

            const results = await yahooFinance.historical(symbol, {
                period1: new Date(from * 1000),
                period2: new Date(to * 1000),
                interval: '1d'
            }) as any[];

            if (!results || results.length === 0) return { s: 'no_data' };

            const data = {
                s: 'ok',
                o: results.map(r => r.open),
                c: results.map(r => r.close),
                h: results.map(r => r.high),
                l: results.map(r => r.low),
                v: results.map(r => r.volume),
                t: results.map(r => Math.floor(r.date.getTime() / 1000))
            };

            await CacheService.setCacheConfig(cacheKey, JSON.stringify(data), 3600, 'YAHOO_FINANCE');
            return data;
        } catch (e) {
            console.error(`Error fetching candles for ${symbol} via YahooFinance:`, e);
            return { s: 'error' };
        }
    }

    static async getProfile(symbol: string) {
        const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
        return fetchWithRateLimit(url, `profile:${symbol}`, 86400); // 24 hours
    }

    static async getMetrics(symbol: string) {
        const url = `${FINNHUB_BASE_URL}/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`;
        return fetchWithRateLimit(url, `metrics:${symbol}`, 86400); // 24 hours
    }

    static async getNews(symbol: string, from: string, to: string) {
        const url = `${FINNHUB_BASE_URL}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;
        return fetchWithRateLimit(url, `news:${symbol}:${from}:${to}`, 21600); // 6 hours
    }
}
