import { prisma } from './cache';
import { MarketData } from './market-data';
import { toDateString } from '../utils/date-helpers';
import { DailyCandles } from './analysis';

export class PriceHistoryService {

    /**
     * Backfill 3 years of daily candles for a symbol.
     * Safe to call multiple times — uses upsert, so no duplicates.
     */
    static async backfillSymbol(symbol: string, assetType: 'STOCK' | 'CRYPTO'): Promise<number> {
        console.log(`[PriceHistory] Backfilling 3-years ${symbol} (${assetType})...`);

        // We explicitly use fetchLiveCandles to bypass local cache
        const candles = await MarketData.fetchLiveCandles(symbol, assetType, '3y');
        if (!candles || candles.s !== 'ok' || !candles.c || candles.c.length === 0) {
            console.warn(`[PriceHistory] No data returned for ${symbol}`);
            throw new Error('Provider returned empty data');
        }

        let inserted = 0;
        let earliestDate = '9999-99-99';
        let latestDate = '0000-00-00';

        const txs = [];
        for (let i = 0; i < candles.t.length; i++) {
            const date = toDateString(new Date(candles.t[i] * 1000));
            if (date < earliestDate) earliestDate = date;
            if (date > latestDate) latestDate = date;

            txs.push(
                prisma.priceHistory.upsert({
                    where: { assetType_symbol_date: { assetType, symbol, date } },
                    update: {
                        open: candles.o[i],
                        high: candles.h[i],
                        low: candles.l[i],
                        close: candles.c[i],
                        volume: candles.v[i]
                    },
                    create: {
                        symbol,
                        assetType,
                        date,
                        open: candles.o[i],
                        high: candles.h[i],
                        low: candles.l[i],
                        close: candles.c[i],
                        volume: candles.v[i]
                    }
                })
            );
            inserted++;
        }

        // Execute sequentially to avoid lock issues
        for (const tx of txs) {
            try { await tx; } catch (e) { }
        }

        // Update the SymbolCacheState
        await prisma.symbolCacheState.upsert({
            where: { assetType_symbol: { assetType, symbol } },
            update: {
                status: 'READY',
                earliestDate: earliestDate !== '9999-99-99' ? earliestDate : null,
                latestDate: latestDate !== '0000-00-00' ? latestDate : null,
                barsCount: inserted,
                lastSuccessAt: new Date()
            },
            create: {
                assetType,
                symbol,
                status: 'READY',
                earliestDate: earliestDate !== '9999-99-99' ? earliestDate : null,
                latestDate: latestDate !== '0000-00-00' ? latestDate : null,
                barsCount: inserted,
                lastSuccessAt: new Date()
            }
        });

        console.log(`[PriceHistory] Stored ${inserted} candles for ${symbol}`);
        return inserted;
    }

    /**
     * Append just today's candle. Called nightly by the scheduler.
     */
    static async appendLatestCandle(symbol: string, assetType: 'STOCK' | 'CRYPTO'): Promise<void> {
        try {
            const candles = await MarketData.getCandles(symbol, assetType, '5d');
            if (!candles || candles.s !== 'ok' || !candles.c || candles.c.length === 0) return;

            // Use the last candle (most recent trading day)
            const i = candles.c.length - 1;
            const date = toDateString(new Date(candles.t[i] * 1000));
            await prisma.priceHistory.upsert({
                where: { assetType_symbol_date: { assetType, symbol, date } },
                update: {
                    open: candles.o[i],
                    high: candles.h[i],
                    low: candles.l[i],
                    close: candles.c[i],
                    volume: candles.v[i]
                },
                create: {
                    symbol,
                    assetType,
                    date,
                    open: candles.o[i],
                    high: candles.h[i],
                    low: candles.l[i],
                    close: candles.c[i],
                    volume: candles.v[i]
                }
            });
            console.log(`[PriceHistory] Updated latest candle for ${symbol} on ${date}`);
        } catch (e: any) {
            console.error(`[PriceHistory] Failed to append candle for ${symbol}: ${e.message}`);
        }
    }

    /**
     * Deprecated: Use MarketData.getCandles directly.
     * Proxies to MarketData cache-first implementation.
     */
    static async getCandles(symbol: string, assetType: 'STOCK' | 'CRYPTO', days: number): Promise<DailyCandles | null> {
        let rangeStr = '6m';
        if (days >= 3650) rangeStr = 'all';
        else if (days >= 1825) rangeStr = '5y';
        else if (days >= 1095) rangeStr = '3y';
        else if (days >= 730) rangeStr = '2y';
        else if (days >= 365) rangeStr = '1y';
        else if (days >= 180) rangeStr = '6m';
        else if (days >= 90) rangeStr = '3m';
        else if (days >= 30) rangeStr = '1m';
        else if (days >= 7) rangeStr = '1w';

        try {
            return await MarketData.getCandles(symbol, assetType, rangeStr) as unknown as DailyCandles;
        } catch (e) {
            return null;
        }
    }

    /**
     * Count cached candles for a symbol. Useful for health checks.
     */
    static async getCandleCount(symbol: string): Promise<number> {
        return prisma.priceHistory.count({ where: { symbol } });
    }

    /**
     * List all distinct symbols in the cache.
     */
    static async getCachedSymbols(): Promise<string[]> {
        const result = await prisma.priceHistory.findMany({
            distinct: ['symbol'],
            select: { symbol: true }
        });
        return result.map((r: any) => r.symbol);
    }
}
