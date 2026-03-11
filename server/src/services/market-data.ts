import { PrixeProvider } from './providers/prixe';
import { BinanceProvider } from './providers/binance';
import { FinnhubService } from './finnhub';
import { FinnhubProvider } from './providers/finnhub';
import { BrapiProvider } from './providers/brapi';
// FMP Removed
import { prisma } from './cache';
import { toDateString } from '../utils/date-helpers';

import { getMarketSession, MarketSessionInfo } from '../utils/market-hours';

export class MarketData {

    static async getQuote(symbol: string, assetType: 'STOCK' | 'CRYPTO') {
        const cacheKey = `quote_${assetType}_${symbol}`;
        let liveQuote: any = null;

        const sessionInfo = getMarketSession(symbol, assetType);

        try {
            if (assetType === 'CRYPTO') {
                liveQuote = await BinanceProvider.getQuote(symbol);
            } else {
                try {
                    // BR Stocks: Primary Brapi -> Fallback Yahoo
                    if (sessionInfo.market === 'BR') {
                        try {
                            liveQuote = await BrapiProvider.getQuote(symbol);
                        } catch (errBrapi) {
                            console.warn(`[MarketData] Brapi failed for ${symbol}, falling back to Yahoo...`);
                            liveQuote = await FinnhubService.getYahooQuote(symbol);
                            if (!liveQuote) throw new Error('Yahoo Finance failed for BR');
                        }
                    }
                    // CA Stocks: Primary Yahoo
                    else if (sessionInfo.market === 'CA') {
                        liveQuote = await FinnhubService.getYahooQuote(symbol);
                        if (!liveQuote) throw new Error('Yahoo Finance failed for CA');
                    }
                    // US Stocks: Primary Prixe -> Finnhub -> Yahoo
                    else {
                        liveQuote = await PrixeProvider.getQuote(symbol);
                    }
                } catch (errPrimary) {
                    if (sessionInfo.market === 'US') {
                        console.warn(`[MarketData] Prixe failed for US ${symbol}, falling back to Finnhub...`);
                        let fhQuote;
                        try {
                            fhQuote = await FinnhubService.getQuote(symbol);
                        } catch (e) {
                            fhQuote = null;
                        }

                        if (!fhQuote || fhQuote.d === null || fhQuote.c === 0) {
                            console.warn(`[MarketData] Finnhub failed for US ${symbol}, falling back to Yahoo...`);
                            const yfQuoteStr = await FinnhubService.getYahooQuote(symbol);
                            if (!yfQuoteStr) throw new Error('All US providers failed');
                            liveQuote = yfQuoteStr;
                        } else {
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
                    } else {
                        // Re-throw if it wasn't a US stock (since CA/BR fallbacks are handled above)
                        throw errPrimary;
                    }
                }
            }
        } catch (e) {
            console.warn(`[MarketData] Live quote failed for ${symbol}, attempting offline cache...`);
        }

        if (liveQuote) {
            // Append session info to live quote
            liveQuote.market = sessionInfo.market;
            liveQuote.sessionStatus = sessionInfo.status;
            liveQuote.quoteType = sessionInfo.quoteType;

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
            // Ensure even offline stale quotes carry the strictly calculated current theoretical session matching real-world time for UI
            parsed.market = sessionInfo.market;
            parsed.sessionStatus = sessionInfo.status;
            parsed.quoteType = sessionInfo.quoteType;
            return parsed;
        }

        throw new Error('Quote unavailable offline and online.');
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
            const cutoffDate = toDateString(cutoff);

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
                '2y': { interval: '1d', limit: 730 },
                '3y': { interval: '1d', limit: 1000 }, // Binance maxes closely
                '5y': { interval: '1d', limit: 1000 },
            };
            const config = map[rangeStr] || map['6m'];
            return await BinanceProvider.getCandles(symbol, config.interval, config.limit);
        } else {
            // STOCK
            const isIntraday = ['1d', '1w'].includes(rangeStr);
            try {
                // Primary: Brapi for BR, Prixe for others
                const toDate = toDateString();
                const fromDateObj = new Date();
                const mapDays: any = { '1d': 2, '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365, '2y': 730, '3y': 1095, '5y': 1825, 'all': 3650 };
                fromDateObj.setDate(fromDateObj.getDate() - (mapDays[rangeStr] || 180));
                const fromDate = toDateString(fromDateObj);
                const interval = isIntraday ? '1h' : '1d';

                if (symbol.endsWith('.SA')) {
                    try {
                        return await BrapiProvider.getCandles(symbol, rangeStr);
                    } catch (errBrapi) {
                        console.warn(`[MarketData] Brapi fallback for ${symbol} candles, falling back to Prixe...`);
                        return await PrixeProvider.getCandles(symbol, fromDate, toDate, interval);
                    }
                } else if (symbol.endsWith('.TO')) {
                    try {
                        const toTs = Math.floor(Date.now() / 1000);
                        const fromTs = Math.floor(fromDateObj.getTime() / 1000);
                        const resolution = isIntraday ? '60' : 'D';
                        return await FinnhubService.getCandles(symbol, resolution, fromTs, toTs);
                    } catch (errYF) {
                        console.warn(`[MarketData] Yahoo Finance fallback for ${symbol} candles, falling back to Prixe...`);
                        return await PrixeProvider.getCandles(symbol, fromDate, toDate, interval);
                    }
                } else {
                    return await PrixeProvider.getCandles(symbol, fromDate, toDate, interval);
                }
            } catch (errPrimary) {
                console.warn(`[MarketData] Primary API fallback for ${symbol} candles, falling back to Finnhub/YF...`);
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
            // Note: Prixe historical API can take full_data: true, but we don't have a dedicated overview yet.
            // Using Finnhub as primary for Overview/Profile since it's more comprehensive on metadata.
            return await FinnhubService.getProfile(symbol);
        } catch (e) {
            console.warn(`[MarketData] Overview failed for ${symbol}`, e);
            return null;
        }
    }

    static async getNews(symbol: string, assetType: 'STOCK' | 'CRYPTO') {
        const toDate = toDateString();
        const fromDate = toDateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

        try {
            if (assetType === 'CRYPTO') {
                const allCryptoNews = await FinnhubService.getGeneralNews('crypto');
                if (!Array.isArray(allCryptoNews)) return [];

                const s = symbol.replace('USD', '').toUpperCase();
                return allCryptoNews.filter((n: any) =>
                    (n.headline && n.headline.toUpperCase().includes(s)) ||
                    (n.summary && n.summary.toUpperCase().includes(s))
                ).slice(0, 10);
            }

            try {
                return await PrixeProvider.getNews(symbol);
            } catch (errPrixe) {
                return await FinnhubProvider.getNews(symbol, fromDate, toDate);
            }
        } catch (e) {
            console.error('[MarketData] getNews Error:', e);
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

    static async getFundamentals(symbol: string, assetType: 'STOCK' | 'CRYPTO') {
        if (assetType === 'CRYPTO') return null;
        try {
            return await FinnhubProvider.getFundamentals(symbol);
        } catch (e) {
            console.error(`[MarketData] getFundamentals Error:`, e);
            return null;
        }
    }

    static async getEarnings(symbol: string, assetType: 'STOCK' | 'CRYPTO') {
        if (assetType === 'CRYPTO') return [];
        try {
            return await FinnhubProvider.getEarningsCalendar(symbol);
        } catch (e) {
            console.error(`[MarketData] getEarnings Error:`, e);
            return [];
        }
    }
}

