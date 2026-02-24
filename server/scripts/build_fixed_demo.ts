import { prisma } from '../src/services/cache';
import { MarketData } from '../src/services/market-data';
import { IndicatorService } from '../src/services/analysis';
import { toDateString } from '../src/utils/date-helpers';

async function main() {
    console.log('🏗️ Starting Hardcoded Demo Data Generation for Jan 1, 2026...');

    // 1. Wipe existing demo data
    await prisma.demoScreenerSnapshot.deleteMany({});
    await prisma.demoAssetSnapshot.deleteMany({});
    await prisma.demoSnapshotMeta.deleteMany({});

    // 2. Set Anchor Date
    const anchorDateStr = '2026-01-01';
    const anchorDate = new Date(anchorDateStr);
    const anchorTs = anchorDate.getTime() / 1000;

    // We set nextRefreshAfter far into the future so it never "expires"
    const nextRefresh = new Date('2030-01-01');

    await prisma.demoSnapshotMeta.create({
        data: {
            snapshotAnchorDate: anchorDateStr,
            nextRefreshAfter: nextRefresh.toISOString()
        }
    });

    // 3. Define target assets
    const demoSymbols = [
        { symbol: 'NVDA', type: 'STOCK' },
        { symbol: 'TSLA', type: 'STOCK' },
        { symbol: 'MSFT', type: 'STOCK' },
        { symbol: 'META', type: 'STOCK' },
        { symbol: 'AAPL', type: 'STOCK' },
        { symbol: 'GOOG', type: 'STOCK' },
        { symbol: 'AMZN', type: 'STOCK' }
    ];

    let screenerRank = 1;

    for (const item of demoSymbols) {
        console.log(`Fetching historical data for ${item.symbol}...`);
        try {
            // Fetch a long history so we have enough data before Jan 1, 2026
            const fullCandles = await MarketData.getCandles(item.symbol, item.type as 'STOCK' | 'CRYPTO', '5y');
            if (!fullCandles || fullCandles.s !== 'ok') {
                console.error(`Failed to fetch ${item.symbol}`);
                continue;
            }

            // Slice candles strictly before Jan 1, 2026
            const sliceIdx = fullCandles.t.findIndex((t: number) => t >= anchorTs);
            const limitIdx = sliceIdx === -1 ? fullCandles.t.length : sliceIdx;

            if (limitIdx < 40) {
                console.error(`Not enough historical data for ${item.symbol} before 2026`);
                continue;
            }

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

            const closes = demoCandles.c;
            const endPrice = closes[closes.length - 1];

            // Calculate some basic mock indicators & analysis
            const rsi = IndicatorService.computeRSI(closes, 14) ?? 50;
            const sma20 = IndicatorService.computeSMA(closes, 20) ?? endPrice;
            const { vol } = IndicatorService.computeVolatilityAndRiskMetrics(closes, 20) ?? { vol: 0.2 };
            const mdd = IndicatorService.computeMaxDrawdown(closes, 90) ?? 0.1;

            const change6m = closes.length > 120 ? ((endPrice - closes[closes.length - 120]) / closes[closes.length - 120]) * 100 : 0;

            const indicators = { rsi, sma20, vol, mdd };

            const riskFlags = [];
            if (rsi > 70) riskFlags.push('Overbought');
            if (rsi < 30) riskFlags.push('Oversold');
            if (vol > 0.4) riskFlags.push('High Volatility');
            if (mdd > 0.3) riskFlags.push('Severe Drawdown');

            const firmView = {
                CONSENSUS: `Mocked Consensus for ${item.symbol}: Structural trends indicated a solid foundation leading into 2026. RSI is at ${rsi.toFixed(1)} with a 6-month return of ${change6m.toFixed(2)}%.`,
                TECHNICAL: `Technical analysis implies standard volatility characteristics, trading ${endPrice > sma20 ? 'above' : 'below'} the 20-day SMA.`,
                FUNDAMENTAL: `Fundamentals remain robust alongside sector performance. (This is static offline data).`
            };

            // Save Snapshot
            await prisma.demoAssetSnapshot.create({
                data: {
                    snapshotAnchorDate: anchorDateStr,
                    assetType: item.type,
                    symbol: item.symbol,
                    quoteJson: JSON.stringify({ price: endPrice, change: change6m, assetType: item.type }),
                    candlesJson: JSON.stringify(demoCandles),
                    indicatorsJson: JSON.stringify(indicators),
                    riskFlagsJson: JSON.stringify(riskFlags),
                    firmViewJson: JSON.stringify(firmView)
                }
            });

            // Mock Screener entry (injecting into SP500 and Tech A for demo purposes)
            const score = Math.max(0, Math.min(100, 50 + change6m));
            await prisma.demoScreenerSnapshot.create({
                data: {
                    snapshotAnchorDate: anchorDateStr,
                    universeName: 'SP500',
                    universeType: item.type,
                    symbol: item.symbol,
                    score: score,
                    metricsJson: JSON.stringify({ return6m: change6m, vol: vol, maxDrawdown: mdd }),
                    riskFlagsJson: JSON.stringify(riskFlags)
                }
            });

            console.log(`✅ Saved static snapshot for ${item.symbol} at $${endPrice.toFixed(2)}`);
            screenerRank++;

        } catch (e) {
            console.error(`Failed processing ${item.symbol}`, e);
        }
    }

    console.log('🎉 Static Demo Generation Complete.');
}

main().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
