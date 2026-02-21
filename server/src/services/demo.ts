import { prisma } from './cache';
import { MarketData } from './market-data';
import { ScreenerService } from './screener';

export class DemoService {
    /**
     * Rebuilds demo snapshots anchored 90 days in the past.
     * For demonstration, we run it for SP500 and CRYPTO universes.
     */
    static async rebuildDemoSnapshots() {
        console.log('🏗️  Starting Demo Snapshot Rebuild...');
        
        const now = new Date();
        const anchorDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
        const anchorDateStr = anchorDate.toISOString().split('T')[0];
        
        // 1. Update Meta
        let meta = await prisma.demoSnapshotMeta.findFirst();
        const nextRefresh = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        
        if (!meta) {
            meta = await prisma.demoSnapshotMeta.create({
                data: {
                    snapshotAnchorDate: anchorDateStr,
                    nextRefreshAfter: nextRefresh.toISOString()
                }
            });
        } else {
            meta = await prisma.demoSnapshotMeta.update({
                where: { id: meta.id },
                data: {
                    snapshotAnchorDate: anchorDateStr,
                    nextRefreshAfter: nextRefresh.toISOString()
                }
            });
        }

        // 2. Build explicit subset for Demo (e.g. top 10 from SP500 and Top Crypto)
        // In a real cheap VPS, we don't want to demo all 500. We'll pick a few.
        const demoSymbols = [
            { symbol: 'AAPL', type: 'STOCK', universe: 'SP500' },
            { symbol: 'MSFT', type: 'STOCK', universe: 'SP500' },
            { symbol: 'BTCUSDT', type: 'CRYPTO', universe: 'CRYPTO' },
            { symbol: 'ETHUSDT', type: 'CRYPTO', universe: 'CRYPTO' }
        ];

        for (const item of demoSymbols) {
            try {
                // Fetch candles up to now, but we will ONLY use data up to anchorDate for demo
                const fullCandles = await MarketData.getCandles(item.symbol, item.type as 'STOCK' | 'CRYPTO', '1y');
                if (!fullCandles || fullCandles.s !== 'ok') continue;

                // Slice candles to simulate "now" being the anchorDate
                const anchorTs = anchorDate.getTime() / 1000;
                const sliceIdx = fullCandles.t.findIndex((t: number) => t > anchorTs);
                const limitIdx = sliceIdx === -1 ? fullCandles.t.length : sliceIdx;
                
                if (limitIdx < 20) continue; // Not enough data for indicators

                const demoCandles = {
                    s: 'ok',
                    t: fullCandles.t.slice(0, limitIdx),
                    o: fullCandles.o.slice(0, limitIdx),
                    h: fullCandles.h.slice(0, limitIdx),
                    l: fullCandles.l.slice(0, limitIdx),
                    c: fullCandles.c.slice(0, limitIdx),
                    v: fullCandles.v.slice(0, limitIdx),
                    source: fullCandles.source
                };

                // Run Screener Metrics manually for the snapshot
                // Note: ScreenerService.calculateScreenerMetrics needs to be public or we copy the logic. 
                // Let's copy it here briefly or we can just mock some indicators since it's demo.
                // For accurate demo, we'll calculate basic metrics.
                const closes = demoCandles.c;
                const startPrice = closes[0];
                const endPrice = closes[closes.length - 1];
                const return6m = ((endPrice - startPrice) / startPrice) * 100;
                
                const score = Math.max(0, Math.min(100, 50 + return6m)); // Simplified score
                const price = endPrice;

                // Save to DemoAssetSnapshot
                await prisma.demoAssetSnapshot.upsert({
                    where: {
                        snapshotAnchorDate_assetType_symbol: {
                            snapshotAnchorDate: anchorDateStr,
                            assetType: item.type,
                            symbol: item.symbol
                        }
                    },
                    update: {
                        quoteJson: JSON.stringify({ price: endPrice, change: return6m, assetType: item.type }),
                        candlesJson: JSON.stringify(demoCandles),
                        indicatorsJson: '{}', // Placeholder for advanced later
                        riskFlagsJson: '[]',
                        firmViewJson: '{}'
                    },
                    create: {
                        snapshotAnchorDate: anchorDateStr,
                        assetType: item.type,
                        symbol: item.symbol,
                        quoteJson: JSON.stringify({ price: endPrice, change: return6m, assetType: item.type }),
                        candlesJson: JSON.stringify(demoCandles),
                        indicatorsJson: '{}',
                        riskFlagsJson: '[]',
                        firmViewJson: '{}'
                    }
                });

                // Save to DemoScreenerSnapshot
                await prisma.demoScreenerSnapshot.upsert({
                    where: {
                        snapshotAnchorDate_universeType_universeName_symbol: {
                            snapshotAnchorDate: anchorDateStr,
                            universeType: item.type === 'CRYPTO' ? 'CRYPTO' : 'STOCK',
                            universeName: item.universe,
                            symbol: item.symbol
                        }
                    },
                    update: {
                        score,
                        metricsJson: JSON.stringify({ return6m }),
                        price,
                        riskFlagsJson: '[]'
                    },
                    create: {
                        snapshotAnchorDate: anchorDateStr,
                        universeType: item.type === 'CRYPTO' ? 'CRYPTO' : 'STOCK',
                        universeName: item.universe,
                        symbol: item.symbol,
                        score,
                        metricsJson: JSON.stringify({ return6m }),
                        price,
                        riskFlagsJson: '[]'
                    }
                });

            } catch(e) {
                console.error(`Failed demo snapshot for ${item.symbol}`, e);
            }
        }

        console.log('✅ Demo Snapshots Rebuilt successfully for date:', anchorDateStr);
    }
}
