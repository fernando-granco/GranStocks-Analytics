import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Small in-memory TTL cache to reduce SQLite load for incredibly hot lookups (like quotes in loop)
const memCache = new Map<string, { value: string, expiresAt: number }>();

export class CacheService {
    /**
     * Wrapper to check memory cache first, then sqlite.
     */
    static async getCacheConfig(key: string): Promise<{ payloadJson: string, isStale: boolean } | null> {
        const now = Date.now();
        // 1. InMemory Check
        const memEntry = memCache.get(key);
        if (memEntry && memEntry.expiresAt > now) {
            return { payloadJson: memEntry.value, isStale: false };
        }

        // 2. Db Check
        const dbEntry = await prisma.cachedResponse.findUnique({
            where: { cacheKey: key }
        });

        if (!dbEntry) return null;

        const expiresAt = new Date(dbEntry.ts.getTime() + dbEntry.ttlSeconds * 1000);
        const staled = new Date() > expiresAt || dbEntry.isStale;

        return { payloadJson: dbEntry.payloadJson, isStale: staled };
    }

    static async setCacheConfig(
        key: string,
        payloadJson: string,
        ttlSeconds: number,
        source: string = 'FINNHUB'
    ) {
        // Write Db
        await prisma.cachedResponse.upsert({
            where: { cacheKey: key },
            update: {
                payloadJson,
                ts: new Date(),
                ttlSeconds,
                isStale: false,
                source
            },
            create: {
                cacheKey: key,
                payloadJson,
                ttlSeconds,
                source
            }
        });

        // Write Mem (max 10 seconds for memory to stay very small and prevent DB thundering herd)
        const memTtl = Math.min(ttlSeconds, 10);
        memCache.set(key, { value: payloadJson, expiresAt: Date.now() + memTtl * 1000 });
    }

    static async markStale(key: string) {
        memCache.delete(key);
        await prisma.cachedResponse.update({
            where: { cacheKey: key },
            data: { isStale: true }
        });
    }
}

export { prisma };
