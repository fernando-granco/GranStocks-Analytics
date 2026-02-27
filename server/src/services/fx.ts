import YahooFinance from 'yahoo-finance2';
import { prisma } from './cache';
import { toDateString } from '../utils/date-helpers';

const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });

export class FXService {
    /**
     * Get historical USD conversion rates for a currency.
     * Returns a map of YYYY-MM-DD -> rate (1 Unit of Currency = X USD)
     */
    static async getHistoricalRates(fromCurrency: string, days: number = 365): Promise<Map<string, number>> {
        const ratesMap = new Map<string, number>();
        if (fromCurrency === 'USD') return ratesMap;

        const symbol = `${fromCurrency}USD=X`;
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - days);

        try {
            // Check cache/DB first (reuse PriceHistory for FX rates to simplify)
            const rows = await prisma.priceHistory.findMany({
                where: {
                    symbol,
                    assetType: 'FX',
                    date: { gte: toDateString(from) }
                },
                orderBy: { date: 'asc' }
            });

            if (rows.length >= days * 0.5) { // 50% coverage check
                rows.forEach(r => ratesMap.set(r.date, r.close));
                return ratesMap;
            }

            // Fetch live if cache insufficient
            console.log(`[FXService] Fetching historical rates for ${symbol}...`);
            const results = await yahooFinance.historical(symbol, {
                period1: from,
                period2: to,
                interval: '1d'
            }) as any[];

            if (results && results.length > 0) {
                const txs = results.map(r => {
                    const date = toDateString(r.date);
                    ratesMap.set(date, r.close);
                    return prisma.priceHistory.upsert({
                        where: { assetType_symbol_date: { assetType: 'FX', symbol, date } },
                        update: { close: r.close, open: r.open, high: r.high, low: r.low, volume: 0 },
                        create: { assetType: 'FX', symbol, date, close: r.close, open: r.open, high: r.high, low: r.low, volume: 0 }
                    });
                });
                await Promise.all(txs);
            }

            return ratesMap;
        } catch (e) {
            console.error(`[FXService] Failed to fetch FX rates for ${symbol}:`, e);
            return ratesMap;
        }
    }

    /**
     * Get a single conversion rate for today or last known.
     */
    static async getCurrentRate(fromCurrency: string): Promise<number> {
        if (fromCurrency === 'USD') return 1.0;
        const symbol = `${fromCurrency}USD=X`;

        try {
            const quote = await yahooFinance.quote(symbol);
            return quote.regularMarketPrice || 1.0;
        } catch (e) {
            // Fallback to last known in DB
            const last = await prisma.priceHistory.findFirst({
                where: { symbol, assetType: 'FX' },
                orderBy: { date: 'desc' }
            });
            return last?.close || 1.0;
        }
    }

    /**
     * Get a cross rate between any two currencies.
     * Uses USD as a bridge if needed.
     */
    static async getCrossRate(from: string, to: string): Promise<number> {
        if (from === to) return 1.0;
        if (to === 'USD') return this.getCurrentRate(from);
        if (from === 'USD') {
            const rateToUSD = await this.getCurrentRate(to);
            return 1.0 / rateToUSD;
        }

        // both non-USD: (from/USD) * (USD/to) => rateFromUSD * (1/rateToUSD)
        const rateFromUSD = await this.getCurrentRate(from);
        const rateToUSD = await this.getCurrentRate(to);
        return rateFromUSD / rateToUSD;
    }
}
