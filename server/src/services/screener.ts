import { prisma } from './cache';
import { MarketData } from './market-data';
import * as fs from 'fs';
import * as path from 'path';

export class ScreenerService {

    static async runScreenerJob(universe: 'SP500' | 'NASDAQ100' | 'CRYPTO', date: string) {
        const assetType = universe === 'CRYPTO' ? 'CRYPTO' : 'STOCK';
        // Setup / Reset Job State
        await prisma.jobState.upsert({
            where: { universeType_universeName: { universeType: assetType, universeName: universe } },
            update: { status: 'RUNNING', cursorIndex: 0 },
            create: { universeType: assetType, universeName: universe, status: 'RUNNING', cursorIndex: 0, total: 0 }
        });

        const symbols = this.loadUniverse(universe);
        await prisma.jobState.update({
            where: { universeType_universeName: { universeType: assetType, universeName: universe } },
            data: { total: symbols.length }
        });


        try {
            for (let i = 0; i < symbols.length; i++) {
                const symbol = symbols[i];

                try {
                    // Fetch 6M data in Daily resolution via unified router
                    const data = await MarketData.getCandles(symbol, assetType, '6m');

                    if (data && data.s === 'ok' && data.c && data.c.length > 0) {
                        const { score, metrics, flags } = this.calculateScreenerMetrics(data.c, data.h, data.l);

                        await prisma.screenerSnapshot.upsert({
                            where: { dateHour_universeType_universeName_symbol: { dateHour: date, universeType: assetType, universeName: universe, symbol } },
                            update: { score, metricsJson: JSON.stringify(metrics), riskFlagsJson: JSON.stringify(flags) },
                            create: { dateHour: date, universeType: assetType, universeName: universe, symbol, score, metricsJson: JSON.stringify(metrics), riskFlagsJson: JSON.stringify(flags) }
                        });
                    }
                } catch (err: any) {
                    console.error(`Error processing ${symbol} for screener:`, err.message);
                }

                // Update cursor every 5 symbols to avoid DB spam
                if (i % 5 === 0) {
                    await prisma.jobState.update({
                        where: { universeType_universeName: { universeType: assetType, universeName: universe } },
                        data: { cursorIndex: i + 1 }
                    });
                }
            }

            await prisma.jobState.update({
                where: { universeType_universeName: { universeType: assetType, universeName: universe } },
                data: { status: 'COMPLETED', cursorIndex: symbols.length }
            });

        } catch (err: any) {
            await prisma.jobState.update({
                where: { universeType_universeName: { universeType: assetType, universeName: universe } },
                data: { status: 'FAILED', lastError: err.message }
            });
        }
    }

    private static loadUniverse(universe: string): string[] {
        const filePath = path.join(__dirname, '..', 'data', `${universe.toLowerCase()}.json`);
        try {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        } catch (e) {
            console.error(`Could not load universe JSON for ${universe}`);
            return [];
        }
    }

    private static calculateScreenerMetrics(closes: number[], highs: number[], lows: number[]) {
        if (closes.length < 20) return { score: 0, metrics: {}, flags: ['Insufficient Data'] };

        const startPrice = closes[0];
        const endPrice = closes[closes.length - 1];
        const return6m = ((endPrice - startPrice) / startPrice) * 100;

        let maxPrice = highs[0];
        let maxDrawdown = 0;
        let diffSums = 0;
        let downsideDiffSums = 0;
        let downsideCount = 0;

        for (let i = 0; i < closes.length; i++) {
            if (highs[i] > maxPrice) maxPrice = highs[i];
            const drawdown = ((maxPrice - lows[i]) / maxPrice) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;

            if (i > 0) {
                const ret = (closes[i] - closes[i - 1]) / closes[i - 1];
                diffSums += ret * ret;
                if (ret < 0) {
                    downsideDiffSums += ret * ret;
                    downsideCount++;
                }
            }
        }

        const volatility = Math.sqrt(diffSums / (closes.length - 1)) * Math.sqrt(252) * 100; // Annualized approx

        const downsideVariance = downsideCount > 0 ? downsideDiffSums / downsideCount : 0;
        const downsideVolatility = Math.sqrt(downsideVariance) * Math.sqrt(252) * 100;

        const rfr = 4.0; // 4% proxy risk-free rate
        const sharpeRatio = volatility > 0 ? (return6m - rfr) / volatility : 0;
        const sortinoRatio = downsideVolatility > 0 ? (return6m - rfr) / downsideVolatility : sharpeRatio;

        // Simple MA trend check
        const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const trendStrength = ((endPrice - ma20) / ma20) * 100;

        // Arbitrary scoring logic for "Best Candidates" (high return, low vol, low drawdown, positive trend)
        let score = 50
            + (return6m > 0 ? Math.min(return6m, 50) : Math.max(return6m, -50))
            - (volatility > 40 ? 10 : 0)
            - (maxDrawdown > 20 ? 15 : 0)
            + (trendStrength > 0 ? 5 : -5)
            + (sharpeRatio > 1 ? 5 : 0) // Reward good risk-adjusted returns
            + (sortinoRatio > 1 ? 5 : 0);

        score = Math.max(0, Math.min(100, score));

        const flags: string[] = [];
        if (volatility > 50) flags.push('High Volatility');
        if (maxDrawdown > 30) flags.push('Severe Drawdown Risk');
        if (trendStrength < -5) flags.push('Strong Downtrend');

        return {
            score,
            metrics: { return6m, volatility, maxDrawdown, trendStrength, sharpeRatio, sortinoRatio },
            flags
        };
    }
}
