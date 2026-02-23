import { AlphaVantageProvider } from './providers/alphavantage';
import { BinanceProvider } from './providers/binance';
import { FinnhubService } from './finnhub';
import { prisma } from './cache';

export class MarketData {

    static async getQuote(symbol: string, assetType: 'STOCK' | 'CRYPTO') {
        const cacheKey = `quote_${assetType}_${symbol}`;
        let liveQuote = null;

        try {
            if (assetType === 'CRYPTO') {
                liveQuote = await BinanceProvider.getQuote(symbol);
            } else {
                try {
                    liveQuote = await AlphaVantageProvider.getQuote(symbol);
                } catch (errAV) {
                    const fhQuote = await FinnhubService.getQuote(symbol);
                    if (!fhQuote || fhQuote.d === null) throw new Error('All providers failed');
                    liveQuote = {
                        symbol,
                        assetType: 'STOCK',
                        price: parseFloat(fhQuote.c),
                        changeAbs: parseFloat(fhQuote.d),
                        changePct: parseFloat(fhQuote.dp),
                        ts: fhQuote.t,
                        source: 'FINNHUB',
                        isStale: false
                    };
                }
            }
        } catch (e) {
            console.warn(`[MarketData] Live quote failed for ${symbol}, attempting cache...`);
        }

        if (liveQuote) {
            // Save to cache
            await prisma.cachedResponse.upsert({
                where: { cacheKey },
                update: { payloadJson: JSON.stringify(liveQuote), ts: new Date(), isStale: false },
                create: { cacheKey, payloadJson: JSON.stringify(liveQuote), ttlSeconds: 300, source: liveQuote.source || 'UNKNOWN' }
            });
            return liveQuote;
        }

        // Offline Fallback
        const cached = await prisma.cachedResponse.findUnique({ where: { cacheKey } });
        if (cached) {
            const parsed = JSON.parse(cached.payloadJson);
            parsed.isStale = true;
            return parsed;
        }

        throw new Error('Quote unavailable offline.');
    }

    static async getCandles(symbol: string, assetType: 'STOCK' | 'CRYPTO', rangeStr: string) {
        // Ping the history warm queue to ensure we have long-term stats building
        import('./history-queue').then(q => q.HistoryWarmQueue.enqueue(symbol, assetType, 'get_candles')).catch(() => { });

        // Determine date cutoff based on rangeStr
        const cutoff = new Date();
        const mapDays: any = { '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365, '2y': 730, '3y': 1095, '5y': 1825, 'all': 3650 };
        const isIntraday = ['1d', '1w'].includes(rangeStr);
        const days = mapDays[rangeStr] || 180;

        if (!isIntraday) {
            cutoff.setDate(cutoff.getDate() - days);
            const cutoffDate = cutoff.toISOString().split('T')[0];

            const rows = await prisma.priceHistory.findMany({
                where: { symbol, assetType, date: { gte: cutoffDate } },
                orderBy: { date: 'asc' }
            });

            const requiredTradingDays = days * 0.6; // approx accounting for weekends
            if (rows.length >= requiredTradingDays) {
                return {
                    c: rows.map(r => r.close),
                    h: rows.map(r => r.high),
                    l: rows.map(r => r.low),
                    o: rows.map(r => r.open),
                    v: rows.map(r => r.volume),
                    t: rows.map(r => Math.floor(new Date(r.date + 'T16:00:00Z').getTime() / 1000)),
                    s: 'ok',
                    isStale: false,
                    fromCache: true
                };
            }

            try {
                const liveData = await this.fetchLiveCandles(symbol, assetType, rangeStr);
                if (liveData && liveData.s === 'ok' && liveData.c.length > 0) {
                    return { ...liveData, isStale: false, fromCache: false };
                }
            } catch (e) {
                console.warn(`[MarketData] Failed to fetch live candles for ${symbol}, checking partial DB cache...`);
            }

            if (rows.length > 0) {
                return {
                    c: rows.map(r => r.close),
                    h: rows.map(r => r.high),
                    l: rows.map(r => r.low),
                    o: rows.map(r => r.open),
                    v: rows.map(r => r.volume),
                    t: rows.map(r => Math.floor(new Date(r.date + 'T16:00:00Z').getTime() / 1000)),
                    s: 'ok',
                    isStale: true,
                    fromCache: true,
                    lowDataQuality: true
                };
            }
        } else {
            // Intraday (1d, 1w) usually comes live directly
            try {
                return await this.fetchLiveCandles(symbol, assetType, rangeStr);
            } catch (e) { }
        }

        throw new Error('No historical data available and live fetch failed.');
    }

    static async fetchLiveCandles(symbol: string, assetType: 'STOCK' | 'CRYPTO', rangeStr: string) {
        if (assetType === 'CRYPTO') {
            // map range to binance interval
            const map: Record<string, { interval: string, limit: number }> = {
                '1d': { interval: '15m', limit: 96 },
                '1w': { interval: '1h', limit: 168 },
                '1m': { interval: '4h', limit: 180 },
                '3m': { interval: '1d', limit: 90 },
                '6m': { interval: '1d', limit: 180 },
                '1y': { interval: '1d', limit: 365 },
            };
            const config = map[rangeStr] || map['6m'];
            return await BinanceProvider.getCandles(symbol, config.interval, config.limit);
        } else {
            // STOCK
            const isIntraday = ['1d', '1w'].includes(rangeStr);
            try {
                const fullData = await AlphaVantageProvider.getCandles(symbol, isIntraday);
                if (rangeStr === 'all') return fullData;

                const toLimit = Math.floor(Date.now() / 1000);
                let fromLimit = 0;
                if (rangeStr === '1m') fromLimit = toLimit - (30 * 24 * 60 * 60);
                else if (rangeStr === '3m') fromLimit = toLimit - (90 * 24 * 60 * 60);
                else if (rangeStr === '6m') fromLimit = toLimit - (180 * 24 * 60 * 60);
                else if (rangeStr === '1y') fromLimit = toLimit - (365 * 24 * 60 * 60);
                else if (rangeStr === '2y') fromLimit = toLimit - (730 * 24 * 60 * 60);
                else if (rangeStr === '5y') fromLimit = toLimit - (1825 * 24 * 60 * 60);
                else fromLimit = toLimit - (180 * 24 * 60 * 60); // Default 6m

                // Slice the data arrays
                const slicedData = { ...fullData, t: [], o: [], h: [], l: [], c: [], v: [] };
                for (let i = 0; i < fullData.t.length; i++) {
                    if (fullData.t[i] >= fromLimit) {
                        slicedData.t.push(fullData.t[i]);
                        slicedData.o.push(fullData.o[i]);
                        slicedData.h.push(fullData.h[i]);
                        slicedData.l.push(fullData.l[i]);
                        slicedData.c.push(fullData.c[i]);
                        slicedData.v.push(fullData.v[i]);
                    }
                }
                return slicedData;
            } catch (errAV) {
                console.warn(`[MarketData] AV failed for ${symbol} candles, falling back to Finnhub/YF...`);
                // Calculate from/to for Finnhub/YF based on rangeStr
                const to = Math.floor(Date.now() / 1000);
                let from = to - (180 * 24 * 60 * 60); // default 6m
                let resolution = 'D';

                if (rangeStr === '1m') { from = to - (30 * 24 * 60 * 60); }
                else if (rangeStr === '3m') { from = to - (90 * 24 * 60 * 60); }
                else if (rangeStr === '1y') { from = to - (365 * 24 * 60 * 60); }
                else if (rangeStr === '2y') { from = to - (730 * 24 * 60 * 60); }
                else if (rangeStr === '5y') { from = to - (1825 * 24 * 60 * 60); }
                else if (rangeStr === 'all') { from = to - (3650 * 24 * 60 * 60); } // 10 years max fallback
                else if (isIntraday) {
                    resolution = '60';
                    from = to - (7 * 24 * 60 * 60); // 1w exactly
                }

                return await FinnhubService.getCandles(symbol, resolution, from, to);
            }
        }
    }

    static async getOverview(symbol: string, assetType: 'STOCK' | 'CRYPTO') {
        if (assetType === 'CRYPTO') {
            return null; // Crypto doesn't have traditional fundamental overview
        }

        try {
            return await AlphaVantageProvider.getOverview(symbol);
        } catch (errAV) {
            console.warn(`[MarketData] AV failed for ${symbol} overview, falling back to Finnhub profile...`);
            return await FinnhubService.getProfile(symbol);
        }
    }

    static async getNews(symbol: string, assetType: 'STOCK' | 'CRYPTO') {
        if (assetType === 'CRYPTO') return [];

        const toDate = new Date().toISOString().split('T')[0];
        const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        try {
            return await FinnhubService.getNews(symbol, fromDate, toDate);
        } catch (e) {
            return [];
        }
    }

    static async getMetrics(symbol: string, assetType: 'STOCK' | 'CRYPTO') {
        if (assetType === 'CRYPTO') return null;
        try {
            return await FinnhubService.getMetrics(symbol);
        } catch (e) {
            return null;
        }
    }
}
