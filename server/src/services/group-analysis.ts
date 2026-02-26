import { IndicatorService } from './analysis';

export interface GroupAssetInput {
    symbol: string;
    assetType: 'STOCK' | 'CRYPTO';
    quantity?: number; // For portfolios
    averageCost?: number; // For portfolios
    country?: string;
    sector?: string;
}

export interface ReturnSeries {
    timestamp: number;
    value: number;
}

export interface GroupAnalysisResult {
    summary: {
        totalValue: number;
        costBasis: number;
        unrealizedPnL: number;
        pnlPercent: number;
        bestPerformer: { symbol: string; pnlPercent: number } | null;
        worstPerformer: { symbol: string; pnlPercent: number } | null;
        dailyReturn: number;
        weeklyReturn: number;
        monthlyReturn: number;
    };
    allocation: {
        byAsset: { name: string; value: number }[];
        byType: { name: string; value: number }[];
        byMarket: { name: string; value: number }[];
    };
    performance: {
        history: ReturnSeries[];
        returns: Record<string, number>;
    };
    risk: {
        volatility: number;
        maxDrawdown: number;
        sharpeRatio: number;
        sortinoRatio: number;
        diversificationScore: number;
        correlationMatrix: Record<string, Record<string, number>>;
    };
    breadth: {
        bullishPercent: number;
        aboveSma20: number;
        aboveSma50: number;
    };
    positions: any[];
}

export class GroupAnalysisEngine {

    // Pearson correlation
    static computeCorrelation(x: number[], y: number[]): number {
        if (x.length !== y.length || x.length === 0) return 0;
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((acc, curr, i) => acc + curr * y[i], 0);
        const sumX2 = x.reduce((a, b) => a + b * b, 0);
        const sumY2 = y.reduce((a, b) => a + b * b, 0);

        const num = n * sumXY - sumX * sumY;
        const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        if (den === 0) return 0;
        return num / den;
    }

    static async analyzeGroup(
        assets: GroupAssetInput[],
        priceHistories: Record<string, any>
    ): Promise<GroupAnalysisResult> {

        let totalValue = 0;
        let costBasis = 0;
        let best: any = null;
        let worst: any = null;
        let bullishCount = 0;
        let sma20Count = 0;
        let sma50Count = 0;

        const positions = [];
        const byAsset: Record<string, number> = {};
        const byType: Record<string, number> = {};
        const byMarket: Record<string, number> = {};

        // 1. Process Individual Assets
        for (const asset of assets) {
            const histRaw = priceHistories[asset.symbol];
            let currentPrice = asset.averageCost || 0;
            let c: number[] = [];
            let t: number[] = [];

            if (histRaw) {
                if (Array.isArray(histRaw)) {
                    // Legacy array of objects: [{c:100, t:123}, ...]
                    c = histRaw.map((h: any) => typeof h === 'number' ? h : h.c);
                    t = histRaw.map((h: any) => h.t || 0);
                } else if (histRaw.s === 'ok' && Array.isArray(histRaw.c)) {
                    // Finnhub format: { s: 'ok', c: [...], t: [...] }
                    c = histRaw.c;
                    t = histRaw.t;
                }
            }

            if (c.length > 0) {
                currentPrice = c[c.length - 1];
            }

            const qty = asset.quantity || 1; // 1 for equal weight universes
            const cost = asset.averageCost || currentPrice;

            const value = currentPrice * qty;
            const cb = cost * qty;
            const pnl = value - cb;
            const pnlP = cb > 0 ? (pnl / cb) * 100 : 0;

            totalValue += value;
            costBasis += cb;

            byAsset[asset.symbol] = value;
            byType[asset.assetType] = (byType[asset.assetType] || 0) + value;
            const mkt = asset.country || (asset.assetType === 'CRYPTO' ? 'Crypto' : 'US');
            byMarket[mkt] = (byMarket[mkt] || 0) + value;

            if (!best || pnlP > best.pnlPercent) best = { symbol: asset.symbol, pnlPercent: pnlP };
            if (!worst || pnlP < worst.pnlPercent) worst = { symbol: asset.symbol, pnlPercent: pnlP };

            positions.push({
                symbol: asset.symbol,
                currentPrice,
                currentValue: value,
                costBasis: cb,
                unrealizedPnL: pnl,
                pnlPercent: pnlP,
                weight: 0 // Will compute below
            });

            // Breadth
            if (c.length > 0) {
                const sma20 = IndicatorService.computeSMA(c, 20);
                const sma50 = IndicatorService.computeSMA(c, 50);
                if (sma20 && currentPrice > sma20) sma20Count++;
                if (sma50 && currentPrice > sma50) sma50Count++;
                if (sma20 && sma50 && sma20 > sma50) bullishCount++;
            }
        }

        positions.forEach(p => p.weight = totalValue > 0 ? (p.currentValue / totalValue) * 100 : 0);

        // 2. Aggregate Portfolio History & Risk
        const historyMap = new Map<number, number>();
        for (const asset of assets) {
            const histRaw = priceHistories[asset.symbol];
            let c: number[] = [];
            let t: number[] = [];

            if (histRaw) {
                if (Array.isArray(histRaw)) {
                    if (histRaw[0]?.c !== undefined && histRaw[0]?.t !== undefined) {
                        c = histRaw.map((h: any) => h.c);
                        t = histRaw.map((h: any) => h.t);
                    }
                } else if (histRaw.s === 'ok' && Array.isArray(histRaw.c)) {
                    c = histRaw.c;
                    t = histRaw.t;
                }
            }

            if (t.length === 0 || c.length === 0 || t.length !== c.length) continue;

            const qty = asset.quantity || 1;
            for (let i = 0; i < c.length; i++) {
                const dayTs = new Date(t[i] * 1000).setUTCHours(0, 0, 0, 0);
                historyMap.set(dayTs, (historyMap.get(dayTs) || 0) + (c[i] * qty));
            }
        }

        const sortedHistory = Array.from(historyMap.entries())
            .map(([timestamp, value]) => ({ timestamp, value }))
            .sort((a, b) => a.timestamp - b.timestamp);

        const groupValues = sortedHistory.map(h => h.value);
        let vol = 0, sharpe = 0, sortino = 0, maxDrawdown = 0;

        if (groupValues.length > 20) {
            const risk = IndicatorService.computeVolatilityAndRiskMetrics(groupValues, 20);
            if (risk) {
                vol = risk.vol; sharpe = risk.sharpe; sortino = risk.sortino;
            }
            maxDrawdown = IndicatorService.computeMaxDrawdown(groupValues, 252) || 0;
        }

        // Returns
        const getRetForDays = (days: number) => {
            if (groupValues.length <= days) return 0;
            const cur = groupValues[groupValues.length - 1];
            const old = groupValues[groupValues.length - 1 - days];
            return old > 0 ? ((cur - old) / old) * 100 : 0;
        };

        const topWeights = positions.sort((a, b) => b.weight - a.weight).slice(0, 5).reduce((a, b) => a + b.weight, 0);
        const divScore = Math.max(0, 100 - topWeights); // Simple heuristic

        return {
            summary: {
                totalValue,
                costBasis,
                unrealizedPnL: totalValue - costBasis,
                pnlPercent: costBasis > 0 ? ((totalValue - costBasis) / costBasis) * 100 : 0,
                bestPerformer: best,
                worstPerformer: worst,
                dailyReturn: getRetForDays(1),
                weeklyReturn: getRetForDays(7),
                monthlyReturn: getRetForDays(30)
            },
            allocation: {
                byAsset: Object.entries(byAsset).map(([name, value]) => ({ name, value })),
                byType: Object.entries(byType).map(([name, value]) => ({ name, value })),
                byMarket: Object.entries(byMarket).map(([name, value]) => ({ name, value }))
            },
            performance: {
                history: sortedHistory,
                returns: {
                    '1D': getRetForDays(1),
                    '1W': getRetForDays(7),
                    '1M': getRetForDays(30),
                    '3M': getRetForDays(90),
                    '6M': getRetForDays(180),
                    '1Y': getRetForDays(252)
                }
            },
            risk: {
                volatility: vol,
                maxDrawdown: maxDrawdown * 100, // convert to %
                sharpeRatio: sharpe,
                sortinoRatio: sortino,
                diversificationScore: divScore,
                correlationMatrix: {} // Placeholder to save payload space
            },
            breadth: {
                bullishPercent: assets.length > 0 ? (bullishCount / assets.length) * 100 : 0,
                aboveSma20: assets.length > 0 ? (sma20Count / assets.length) * 100 : 0,
                aboveSma50: assets.length > 0 ? (sma50Count / assets.length) * 100 : 0
            },
            positions: positions.sort((a, b) => b.weight - a.weight)
        };
    }
}
