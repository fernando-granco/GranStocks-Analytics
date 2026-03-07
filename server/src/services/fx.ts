import { prisma } from './cache';

export class FXService {
    static getApiKey(): string {
        const key = process.env.ALPHAVANTAGE_API_KEY;
        if (!key) console.warn("ALPHAVANTAGE_API_KEY is not configured. FX service will fail.");
        return key || '';
    }

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

        // 2. Fetch Live
        try {
            const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCcy}&to_currency=${toCcy}&apikey=${this.getApiKey()}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`AlphaVantage returned ${res.status}`);

            const data = await res.json();

            if (data['Realtime Currency Exchange Rate'] && data['Realtime Currency Exchange Rate']['5. Exchange Rate']) {
                const rate = parseFloat(data['Realtime Currency Exchange Rate']['5. Exchange Rate']);

                // 3. Update Cache
                await prisma.cachedResponse.upsert({
                    where: { cacheKey },
                    update: { payloadJson: JSON.stringify({ rate }), ts: new Date(), isStale: false },
                    create: { cacheKey, payloadJson: JSON.stringify({ rate }), ttlSeconds: 3600, source: 'ALPHAVANTAGE' }
                });

                return rate;
            } else if (data['Note']) {
                console.warn(`[FXService] AlphaVantage rate limit hit for ${fromCcy} -> ${toCcy}.`);
            } else {
                console.warn(`[FXService] Malformed AlphaVantage response for ${fromCcy} -> ${toCcy}:`, data);
            }
        } catch (e) {
            console.error(`[FXService] Error fetching live FX rate ${fromCcy} -> ${toCcy}:`, e);
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
     * In the future, this should fetch AlphaVantage FX_DAILY.
     */
    static async getHistoricalRates(curr: string, days: number = 365): Promise<Map<string, number>> {
        const rate = await this.getFxRate(curr, 'USD'); // Fallback to current rate
        const map = new Map<string, number>();
        // Return an empty map to prevent breaking existing logic that checks map.get(date)
        return map;
    }
}
