import cron from 'node-cron';
import { prisma } from './cache';
import { FinnhubService } from './finnhub';
import { IndicatorService, PredictionService } from './analysis';

export class DailyJobService {
    static async runDailyJob(overrideDateStr?: string) {
        // America/Vancouver timezone
        const dateStr = overrideDateStr || new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Vancouver',
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

                // Fetch data for the last 180 days relative to now
                const to = Math.floor(Date.now() / 1000);
                const from = to - (180 * 24 * 60 * 60);
                const candles = await FinnhubService.getCandles(asset.symbol, 'D', from, to);

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
        // Runs at 18:00 America/Vancouver Time daily
        cron.schedule('0 18 * * *', () => {
            this.runDailyJob().catch(console.error);
        }, {
            timezone: 'America/Vancouver'
        });
        console.log('Daily Job Cron Scheduled for 18:00 America/Vancouver');
    }
}
