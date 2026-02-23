import { prisma } from './cache';
import { MarketData } from './market-data';
import { PriceHistoryService } from './price-history';
import * as fs from 'fs';
import * as path from 'path';
import { AnalysisConfigPayload, DEFAULT_ANALYSIS_CONFIG } from './config';

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
                    // Use cached price history (API-free, instant)
                    const data = await PriceHistoryService.getCandles(symbol, assetType, 180) as any;

                    if (data && data.s === 'ok' && data.c && data.c.length > 0) {
                        const { score, metrics, flags } = this.calculateScreenerMetrics(data.c, data.h, data.l);

                        await prisma.screenerSnapshot.upsert({
                            where: { date_universeType_universeName_symbol: { date, universeType: assetType, universeName: universe, symbol } },
                            update: { score, metricsJson: JSON.stringify(metrics), riskFlagsJson: JSON.stringify(flags) },
                            create: { date, universeType: assetType, universeName: universe, symbol, score, metricsJson: JSON.stringify(metrics), riskFlagsJson: JSON.stringify(flags) }
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

    private static calculateScreenerMetrics(closes: number[], highs: number[], lows: number[], config: AnalysisConfigPayload['screener'] = DEFAULT_ANALYSIS_CONFIG.screener) {
        if (!closes || closes.length < 20) return { score: 0, metrics: {}, flags: ['Insufficient Data'] };

        let startPrice = closes[0] || 0.0001; // Prevent divide by zero
        const endPrice = closes[closes.length - 1] || 0;
        const return6m = ((endPrice - startPrice) / startPrice) * 100;

        let maxPrice = highs[0] || 0.0001;
        let maxDrawdown = 0;
        let diffSums = 0;
        let downsideDiffSums = 0;
        let downsideCount = 0;

        for (let i = 0; i < closes.length; i++) {
            if (highs[i] > maxPrice) maxPrice = highs[i] || 0.0001;
            const drawdown = ((maxPrice - (lows[i] || 0)) / maxPrice) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;

            if (i > 0) {
                const prevClose = closes[i - 1] || 0.0001;
                const ret = (closes[i] - prevClose) / prevClose;
                diffSums += ret * ret;
                if (ret < 0) {
                    downsideDiffSums += ret * ret;
                    downsideCount++;
                }
            }
        }

        const denom = Math.max(1, closes.length - 1);
        let volatility = Math.sqrt(diffSums / denom) * Math.sqrt(252) * 100;
        if (isNaN(volatility)) volatility = 0;

        const downsideVariance = downsideCount > 0 ? downsideDiffSums / downsideCount : 0;
        let downsideVolatility = Math.sqrt(downsideVariance) * Math.sqrt(252) * 100;
        if (isNaN(downsideVolatility)) downsideVolatility = 0;

        const rfr = 4.0; // 4% proxy risk-free rate
        let sharpeRatio = volatility > 0 ? (return6m - rfr) / volatility : 0;
        let sortinoRatio = downsideVolatility > 0 ? (return6m - rfr) / downsideVolatility : sharpeRatio;

        if (isNaN(sharpeRatio) || !isFinite(sharpeRatio)) sharpeRatio = 0;
        if (isNaN(sortinoRatio) || !isFinite(sortinoRatio)) sortinoRatio = 0;

        // Simple MA trend check
        const ma20denom = closes.slice(-20).reduce((a, b) => a + b, 0) / 20 || 0.0001;
        let trendStrength = ((endPrice - ma20denom) / ma20denom) * 100;
        if (isNaN(trendStrength) || !isFinite(trendStrength)) trendStrength = 0;

        // Arbitrary scoring logic for "Best Candidates" (high return, low vol, low drawdown, positive trend)
        let score = 50
            + (return6m > 0 ? Math.min(return6m, 50) : Math.max(return6m, -50))
            - (volatility > config.volatilityThreshold ? config.volatilityPenalty : 0)
            - (maxDrawdown > config.drawdownThreshold ? config.drawdownPenalty : 0)
            + (trendStrength > 0 ? config.trendStrengthReward : -config.trendStrengthPenalty)
            + (sharpeRatio > 1 ? config.sharpeReward : 0) // Reward good risk-adjusted returns
            + (sortinoRatio > 1 ? config.sortinoReward : 0);

        score = isNaN(score) ? 0 : Math.max(0, Math.min(100, score));

        const flags: string[] = [];
        if (closes.length < 90) flags.push('Limited History');
        if (volatility > config.volatilityThreshold) flags.push('High Volatility');
        if (maxDrawdown > config.drawdownThreshold) flags.push('Severe Drawdown Risk');
        if (trendStrength < -5) flags.push('Strong Downtrend');

        return {
            score,
            metrics: {
                return6m: isNaN(return6m) ? 0 : return6m,
                volatility,
                maxDrawdown: isNaN(maxDrawdown) ? 0 : maxDrawdown,
                trendStrength,
                sharpeRatio,
                sortinoRatio
            },
            flags
        };
    }
}
