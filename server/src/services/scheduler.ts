import cron from 'node-cron';
import { prisma } from './cache';
import { MarketData } from './market-data';
import { IndicatorService, PredictionService, FirmViewService } from './analysis';
import { DemoService } from './demo';
import { ScreenerService } from './screener';

export class DailyJobService {
    static async runDailyJob(overrideDateStr?: string) {
        // America/Toronto timezone
        const dateStr = overrideDateStr || new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Toronto',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());

        console.log(`Starting Daily Job for Date: ${dateStr}`);

        const assets = await prisma.asset.findMany({ where: { isActive: true } });

        for (const asset of assets) {
            try {
                // Idempotency: skip if already computed
                const existing = await prisma.indicatorSnapshot.findUnique({
                    where: { symbol_date: { symbol: asset.symbol, date: dateStr } }
                });

                if (existing) {
                    console.log(`[Job] Skip ${asset.symbol}: already processed for ${dateStr}`);
                    continue;
                }

                // Fetch data for the last 6 months using unified router
                const candles = await MarketData.getCandles(asset.symbol, asset.type as 'STOCK' | 'CRYPTO', '6m');

                if (!candles || candles.s !== 'ok') {
                    console.log(`[Job] Warning: Could not fetch candles for ${asset.symbol}`);
                    continue;
                }

                // Compute Indicators
                const indicators = IndicatorService.computeAll(candles);
                if (!indicators) continue;

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

                // Compute Firm Views (AnalysisSnapshot)
                const firmViews = FirmViewService.generateFirmViews(indicators);
                for (const [role, payload] of Object.entries(firmViews)) {
                    await prisma.analysisSnapshot.upsert({
                        where: { dateHour_assetType_symbol_role: { symbol: asset.symbol, role, dateHour: dateStr, assetType: asset.type } },
                        update: { payloadJson: JSON.stringify(payload) },
                        create: {
                            symbol: asset.symbol,
                            assetType: asset.type,
                            role,
                            dateHour: dateStr,
                            payloadJson: JSON.stringify(payload)
                        }
                    });
                }

                console.log(`[Job] Successfully processed ${asset.symbol} for ${dateStr}`);

                // Sleep brief moment to allow tokens to refill cleanly if queue is very large
                await new Promise(r => setTimeout(r, 1000));
            } catch (err) {
                console.error(`[Job] Error processing ${asset.symbol}:`, err);
            }
        }
        console.log(`[Job] Completed Daily Job for Date: ${dateStr}`);
    }

    static startCron() {
        // Runs at 18:00 America/Toronto Time daily
        cron.schedule('0 18 * * *', () => {
            this.runDailyJob().catch(console.error);
        }, {
            timezone: 'America/Toronto'
        });
        console.log('Daily Job Cron Scheduled for 18:00 America/Toronto');

        // Runs at the 15th minute of every hour (e.g. 1:15, 2:15)
        cron.schedule('15 * * * *', () => {
            console.log('Running Hourly Screener Job...');
            ScreenerService.runScreenerJob('SP500', new Date().toISOString().substring(0, 13) + ':00').catch(console.error);
            ScreenerService.runScreenerJob('CRYPTO', new Date().toISOString().substring(0, 13) + ':00').catch(console.error);
        });
        console.log('Hourly Screener Job Scheduled');

        // Runs on the 1st of every month at midnight
        cron.schedule('0 0 1 * *', () => {
            console.log('Running Monthly Demo Snapshot Rebuild...');
            DemoService.rebuildDemoSnapshots().catch(console.error);
        });
        console.log('Monthly Demo Snapshot Rebuild Scheduled');
    }
}
