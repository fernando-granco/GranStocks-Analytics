import { prisma } from './cache';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });

export class FXService {
    /**
     * Gets the real-time FX rate from a source currency to a target currency.
     * Caches the result using CachedResponse table for 1 hour.
     */
    static async getFxRate(fromCcy: string, toCcy: string): Promise<number> {
        if (fromCcy === toCcy) return 1.0;

        const cacheKey = `fx_rate_${fromCcy}_${toCcy}`;

        // 1. Check Cache
        const cached = await prisma.cachedResponse.findUnique({ where: { cacheKey } });
        if (cached && !cached.isStale && (Date.now() - new Date(cached.ts).getTime() < 3600000)) { // 1 hour TTL
            const parsed = JSON.parse(cached.payloadJson);
            return typeof parsed.rate === 'number' ? parsed.rate : parseFloat(parsed.rate);
        }

        // 2. Fetch Live via Yahoo Finance
        try {
            // Yahoo Finance FX format is usually e.g., "CADUSD=X"
            const symbol = `${fromCcy}${toCcy}=X`;
            const result = await yahooFinance.quote(symbol);

            if (result && result.regularMarketPrice) {
                const rate = result.regularMarketPrice;

                // 3. Update Cache
                await prisma.cachedResponse.upsert({
                    where: { cacheKey },
                    update: { payloadJson: JSON.stringify({ rate }), ts: new Date(), isStale: false },
                    create: { cacheKey, payloadJson: JSON.stringify({ rate }), ttlSeconds: 3600, source: 'YAHOO_FINANCE' }
                });

                return rate;
            } else {
                console.warn(`[FXService] Yahoo Finance returned invalid rate for ${symbol}`, result);
            }
        } catch (e) {
            console.error(`[FXService] Error fetching live FX rate ${fromCcy} -> ${toCcy} via Yahoo Finance:`, e);
        }

        // 4. Fallback to stale cache if available
        if (cached) {
            const parsed = JSON.parse(cached.payloadJson);
            return typeof parsed.rate === 'number' ? parsed.rate : parseFloat(parsed.rate);
        }

        // 5. Final Defaults
        console.warn(`[FXService] Critical failure getting FX for ${fromCcy}->${toCcy}, using hardcoded defaults.`);
        if (fromCcy === 'BRL' && toCcy === 'USD') return 0.17; // Approximate
        if (fromCcy === 'CAD' && toCcy === 'USD') return 0.70; // Approximate
        return 1.0;
    }

    /**
     * Gets historical FX rates. Currently a stub that returns a flat rate using getFxRate.
     * In the future, this should fetch Yahoo Finance historical FX.
     */
    static async getHistoricalRates(curr: string, days: number = 365): Promise<Map<string, number>> {
        const rate = await this.getFxRate(curr, 'USD'); // Fallback to current rate
        const map = new Map<string, number>();
        map.set('fallback', rate);
        return map;
    }
}
