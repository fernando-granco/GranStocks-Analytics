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
        assets: (GroupAssetInput & { currency?: string })[],
        priceHistories: Record<string, any>,
        baseCurrency: string = 'USD'
    ): Promise<GroupAnalysisResult> {
        const { FXService } = await import('./fx');
        const { prisma } = await import('./cache');

        let totalValueBase = 0;
        let costBasisBase = 0;
        let best: any = null;
        let worst: any = null;
        let bullishCount = 0;
        let sma20Count = 0;
        let sma50Count = 0;

        const positions = [];
        const byAsset: Record<string, number> = {};
        const byType: Record<string, number> = {};
        const byMarket: Record<string, number> = {};

        // 0. Resolve Currencies for all assets
        const resolvedAssets = await Promise.all(assets.map(async (asset) => {
            if (asset.currency) return asset;
            const dbAsset = await prisma.asset.findUnique({ where: { symbol: asset.symbol } });
            return { ...asset, currency: dbAsset?.currency || (asset.assetType === 'CRYPTO' ? 'USD' : 'USD') };
        }));

        // Fetch FX rates for needed currencies (Bridged through USD if needed)
        const uniqueCurrencies = [...new Set(resolvedAssets.map(a => a.currency).filter(c => c !== baseCurrency))];
        const fxRatesMapToBase: Record<string, Map<string, number>> = {};

        // Multi-currency bridge: From [CAD, BRL] to [USD] then [USD] to Base
        const usdToBaseHistorical = baseCurrency === 'USD' ? null : await FXService.getHistoricalRates(baseCurrency, 365);

        await Promise.all(uniqueCurrencies.map(async (curr) => {
            if (curr && curr !== 'USD') {
                fxRatesMapToBase[curr] = await FXService.getHistoricalRates(curr, 365);
            }
        }));

        // 1. Process Individual Assets (Latest Snapshot)
        for (const asset of resolvedAssets) {
            const histRaw = priceHistories[asset.symbol];
            let rawC: number[] = [];
            let rawT: number[] = [];

            if (histRaw) {
                if (Array.isArray(histRaw)) {
                    rawC = histRaw.map((h: any) => typeof h === 'number' ? h : h.c);
                    rawT = histRaw.map((h: any) => h.t || 0);
                } else if (histRaw.s === 'ok' && Array.isArray(histRaw.c)) {
                    rawC = histRaw.c;
                    rawT = histRaw.t;
                }
            }

            const latestPriceLocal = rawC.length > 0 ? rawC[rawC.length - 1] : (asset.averageCost || 0);

            // Current rate normalization: Local -> Base
            const rateLocalToBase = await FXService.getCrossRate(asset.currency || 'USD', baseCurrency);

            const latestPriceBase = latestPriceLocal * rateLocalToBase;
            const qty = asset.quantity || 1;
            const costBase = (asset.averageCost || latestPriceLocal) * rateLocalToBase;

            const valueBase = latestPriceBase * qty;
            const cbBase = costBase * qty;
            const pnlBase = valueBase - cbBase;
            const pnlP = cbBase > 0 ? (pnlBase / cbBase) * 100 : 0;

            totalValueBase += valueBase;
            costBasisBase += cbBase;

            byAsset[asset.symbol] = valueBase;
            byType[asset.assetType] = (byType[asset.assetType] || 0) + valueBase;
            const mkt = asset.country || (asset.assetType === 'CRYPTO' ? 'Crypto' : (asset.symbol.endsWith('.SA') ? 'BR' : (asset.symbol.endsWith('.TO') ? 'CA' : 'US')));
            byMarket[mkt] = (byMarket[mkt] || 0) + valueBase;

            if (!best || pnlP > best.pnlPercent) best = { symbol: asset.symbol, pnlPercent: pnlP };
            if (!worst || pnlP < worst.pnlPercent) worst = { symbol: asset.symbol, pnlPercent: pnlP };

            positions.push({
                symbol: asset.symbol,
                currentPrice: latestPriceLocal,
                currentPriceBase: latestPriceBase,
                currency: asset.currency,
                currentValue: valueBase,
                costBasis: cbBase,
                unrealizedPnL: pnlBase,
                pnlPercent: pnlP,
                weight: 0
            });

            // Breadth
            if (rawC.length > 0) {
                const sma20 = IndicatorService.computeSMA(rawC, 20);
                const sma50 = IndicatorService.computeSMA(rawC, 50);
                if (sma20 && latestPriceLocal > sma20) sma20Count++;
                if (sma50 && latestPriceLocal > sma50) sma50Count++;
                if (sma20 && sma50 && sma20 > sma50) bullishCount++;
            }
        }

        positions.forEach(p => p.weight = totalValueBase > 0 ? (p.currentValue / totalValueBase) * 100 : 0);

        // 2. Aggregate Portfolio History (Aligned & Normalized)
        const assetSeries = resolvedAssets.map(asset => {
            const histRaw = priceHistories[asset.symbol];
            const tsMap = new Map<number, number>();
            if (!histRaw) return { symbol: asset.symbol, currency: asset.currency, tsMap, qty: asset.quantity || 1 };

            let c: number[] = [], t: number[] = [];
            if (Array.isArray(histRaw)) {
                c = histRaw.map(h => h.c); t = histRaw.map(h => h.t);
            } else if (histRaw.s === 'ok') {
                c = histRaw.c; t = histRaw.t;
            }

            for (let i = 0; i < t.length; i++) {
                const dayTs = new Date(t[i] * 1000).setUTCHours(0, 0, 0, 0);
                tsMap.set(dayTs, c[i]);
            }
            return { symbol: asset.symbol, currency: asset.currency, tsMap, qty: asset.quantity || 1 };
        });

        const allDates = new Set<number>();
        assetSeries.forEach(s => s.tsMap.forEach((_, ts) => allDates.add(ts)));
        const sortedDates = Array.from(allDates).sort((a, b) => a - b);

        const alignedHistory: ReturnSeries[] = [];
        const lastKnownPrices = new Map<string, number>();

        for (const dateTs of sortedDates) {
            let dailyTotalBase = 0;
            const dateStr = new Date(dateTs).toISOString().split('T')[0];

            for (const asset of assetSeries) {
                let price = asset.tsMap.get(dateTs);
                if (price === undefined) {
                    price = lastKnownPrices.get(asset.symbol);
                } else {
                    lastKnownPrices.set(asset.symbol, price);
                }

                if (price !== undefined) {
                    // Local -> USD -> Base
                    let rateAssetToUSD = 1.0;
                    if (asset.currency !== 'USD') {
                        rateAssetToUSD = fxRatesMapToBase[asset.currency || 'USD']?.get(dateStr)
                            || fxRatesMapToBase[asset.currency || 'USD']?.values().next().value
                            || 1.0;
                    }

                    let rateUSDToBase = 1.0;
                    if (baseCurrency !== 'USD' && usdToBaseHistorical) {
                        const usdRateFromBase = usdToBaseHistorical.get(dateStr) || usdToBaseHistorical.values().next().value || 1.0;
                        rateUSDToBase = 1.0 / usdRateFromBase;
                    }

                    dailyTotalBase += price * asset.qty * rateAssetToUSD * rateUSDToBase;
                }
            }
            alignedHistory.push({ timestamp: dateTs, value: dailyTotalBase });
        }

        const groupValues = alignedHistory.map(h => h.value);
        let vol = 0, sharpe = 0, sortino = 0, maxDrawdown = 0;

        if (groupValues.length > 5) {
            const risk = IndicatorService.computeVolatilityAndRiskMetrics(groupValues, 20);
            if (risk) {
                vol = risk.vol; sharpe = risk.sharpe; sortino = risk.sortino;
            }
            maxDrawdown = IndicatorService.computeMaxDrawdown(groupValues, 252) || 0;
        }

        const getRetForDays = (days: number) => {
            if (groupValues.length <= days) return 0;
            const cur = groupValues[groupValues.length - 1];
            const old = groupValues[groupValues.length - 1 - days];
            return old > 0 ? ((cur - old) / old) * 100 : 0;
        };

        const topWeights = positions.sort((a, b) => b.weight - a.weight).slice(0, 5).reduce((a, b) => a + b.weight, 0);
        const divScore = Math.max(0, 100 - topWeights);

        return {
            summary: {
                totalValue: totalValueBase,
                costBasis: costBasisBase,
                unrealizedPnL: totalValueBase - costBasisBase,
                pnlPercent: costBasisBase > 0 ? ((totalValueBase - costBasisBase) / costBasisBase) * 100 : 0,
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
                history: alignedHistory,
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
                maxDrawdown: maxDrawdown * 100,
                sharpeRatio: sharpe,
                sortinoRatio: sortino,
                diversificationScore: divScore,
                correlationMatrix: {}
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
