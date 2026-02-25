import cron from 'node-cron';
import { prisma } from './cache';
import { MarketData } from './market-data';
import { IndicatorService, PredictionService, FirmViewService } from './analysis';
import { PriceHistoryService } from './price-history';
import { DemoService } from './demo';
import { ScreenerService } from './screener';
import { AlertService } from './alerts';
import { toDateString } from '../utils/date-helpers';

export class DailyJobService {
    static async processAsset(asset: any, dateStr: string) {
        try {
            // Idempotency: skip if already computed
            const existing = await prisma.indicatorSnapshot.findUnique({
                where: { symbol_date: { symbol: asset.symbol, date: dateStr } }
            });

            if (existing) {
                console.log(`[Job] Skip ${asset.symbol}: already processed for ${dateStr}`);
                return;
            }

            // Use price history cache; falls back to live API if cache empty
            const candles = await PriceHistoryService.getCandles(asset.symbol, asset.type as 'STOCK' | 'CRYPTO', 180);

            if (!candles || (candles as any).s !== 'ok') {
                console.log(`[Job] Warning: No candle data for ${asset.symbol}`);
                return;
            }

            // Compute Indicators
            const indicators = IndicatorService.computeAll(candles);
            if (!indicators) return;

            // Save Snapshot
            await prisma.indicatorSnapshot.create({
                data: {
                    symbol: asset.symbol,
                    date: dateStr,
                    indicatorsJson: JSON.stringify(indicators)
                }
            });

            // Compute Predictions
            const horizons = [1, 5, 20] as const;
            for (const horizon of horizons) {
                const pred = PredictionService.predict(indicators, horizon);

                await prisma.predictionSnapshot.create({
                    data: {
                        symbol: asset.symbol,
                        date: dateStr,
                        horizonDays: horizon,
                        predictedReturnPct: pred.predictedReturnPct,
                        predictedPrice: pred.predictedPrice,
                        confidence: pred.confidence,
                        featuresJson: JSON.stringify({
                            sma20: indicators.sma20,
                            rsi14: indicators.rsi14,
                            vol20: indicators.vol20,
                        }),
                        explanationText: pred.explanationText
                    }
                });
            }

            // Evaluate Alerts for the end-of-day close
            if (candles.c && candles.c.length > 0) {
                const latestClose = candles.c[candles.c.length - 1];
                await AlertService.evaluateAlerts(asset.symbol, asset.type as 'STOCK' | 'CRYPTO', latestClose, indicators.rsi14 ?? undefined);
            }

            // Compute Firm Views (AnalysisSnapshot)
            const firmViews = FirmViewService.generateFirmViews(indicators);
            for (const [role, payload] of Object.entries(firmViews)) {
                await prisma.analysisSnapshot.upsert({
                    where: { date_assetType_symbol_role: { symbol: asset.symbol, role, date: dateStr, assetType: asset.type } },
                    update: { payloadJson: JSON.stringify(payload) },
                    create: {
                        symbol: asset.symbol,
                        assetType: asset.type,
                        role,
                        date: dateStr,
                        payloadJson: JSON.stringify(payload)
                    }
                });
            }

            console.log(`[Job] Successfully processed ${asset.symbol} for ${dateStr}`);

            // Sleep brief moment to allow tokens to refill cleanly if queue is very large
            await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
            console.error(`[Job] Error processing ${asset.symbol}: `, err);
        }
    }

    static async runDailyJob(overrideDateStr?: string) {
        // Enforce shared analysis timezone
        const dateStr = overrideDateStr || toDateString();

        console.log(`Starting Daily Job for Date: ${dateStr} `);

        // 1. Gather all active global assets
        const globalAssets = await prisma.asset.findMany({ where: { isActive: true } });
        const assetMap = new Map<string, { symbol: string, type: string }>();
        globalAssets.forEach(a => assetMap.set(a.symbol, { symbol: a.symbol, type: a.type }));

        // 2. Gather all individually tracked assets
        const tracked = await prisma.trackedAsset.findMany();
        tracked.forEach(t => {
            if (!assetMap.has(t.symbol)) {
                // Assume STOCK if not in global db for now, though it could be crypto.
                // An improvement would be storing assetType in TrackedAsset.
                assetMap.set(t.symbol, { symbol: t.symbol, type: 'STOCK' });
            }
        });

        // 3. Gather assets from all Universes
        const universes = await prisma.universe.findMany();
        universes.forEach(u => {
            try {
                const def = JSON.parse(u.definitionJson);
                if (Array.isArray(def.symbols)) {
                    def.symbols.forEach((s: any) => {
                        if (!assetMap.has(s.symbol)) {
                            assetMap.set(s.symbol, { symbol: s.symbol, type: s.assetType || 'STOCK' });
                        }
                    });
                }
            } catch (e) {
                // ignore parsing errors for a single universe
            }
        });

        const assetsToProcess = Array.from(assetMap.values());
        console.log(`[Job] Found ${assetsToProcess.length} unique assets to process across all sources.`);

        for (const asset of assetsToProcess) {
            await this.processAsset(asset, dateStr);
        }
        console.log(`[Job] Completed Daily Job for Date: ${dateStr} `);
    }

    static startCron() {
        const activeTz = process.env.ANALYSIS_TIMEZONE || 'America/New_York';

        // Runs at 18:00 Time daily
        cron.schedule('0 18 * * *', () => {
            this.runDailyJob().catch(console.error);
        }, {
            timezone: activeTz
        });
        console.log(`Daily Job Cron Scheduled for 18:00 ${activeTz}`);

        // Nightly candle append — runs at 18:30 to give daily bars time to settle
        cron.schedule('30 18 * * *', async () => {
            console.log('[PriceHistory] Appending latest candles for all tracked assets...');
            const assets = await prisma.asset.findMany({ where: { isActive: true } });
            for (const asset of assets) {
                await PriceHistoryService.appendLatestCandle(asset.symbol, asset.type as 'STOCK' | 'CRYPTO');
            }
        }, { timezone: activeTz });
        console.log(`Nightly PriceHistory Append Scheduled for 18:30 ${activeTz}`);

        // Hourly Screener Refresh
        cron.schedule('0 * * * *', async () => {
            console.log('[Screener] Refreshing top-level screeners for the hour...');
            const universes = ['SP500', 'NASDAQ100', 'CRYPTO'];
            const date = new Date().toISOString().split('T')[0];

            for (const u of universes) {
                const assetType = u === 'CRYPTO' ? 'CRYPTO' : 'STOCK';
                // Fire and forget so we don't stall the loop entirely, but could also await
                ScreenerService.runScreenerJob(u as 'SP500' | 'NASDAQ100' | 'CRYPTO', date).catch(e => {
                    console.error(`[Screener] Hourly refresh failed for ${u}:`, e);
                });
            }
        }, { timezone: activeTz });
        console.log(`Hourly Screener Refresh Scheduled for 0 * * * * ${activeTz}`);

        // Monthly demo snapshot rebuild disabled (demo is frozen on Jan 1, 2026)
        // cron.schedule('0 0 1 * *', () => {
        //     console.log('Running Monthly Demo Snapshot Rebuild...');
        //     DemoService.rebuildDemoSnapshots().catch(console.error);
        // });
        // console.log('Monthly Demo Snapshot Rebuild Scheduled');
    }
}
