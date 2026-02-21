import { AlphaVantageProvider } from './providers/alphavantage';
import { BinanceProvider } from './providers/binance';
import { FinnhubService } from './finnhub';

export class MarketData {

    static async getQuote(symbol: string, assetType: 'STOCK' | 'CRYPTO') {
        if (assetType === 'CRYPTO') {
            return await BinanceProvider.getQuote(symbol);
        } else {
            // STOCK: 1) AV Primary, 2) Finnhub Secondary
            try {
                return await AlphaVantageProvider.getQuote(symbol);
            } catch (errAV) {
                console.warn(`[MarketData] AV failed for ${symbol} quote, falling back to Finnhub...`);
                const fhQuote = await FinnhubService.getQuote(symbol);
                if (!fhQuote || fhQuote.d === null) throw new Error('All providers failed for quote');

                return {
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
    }

    static async getCandles(symbol: string, assetType: 'STOCK' | 'CRYPTO', rangeStr: string) {
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
