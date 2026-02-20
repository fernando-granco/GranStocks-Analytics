// Compute basic indicators from OHLCV array
// Finnhub candles format: { c: [], h: [], l: [], o: [], v: [], t: [], s: "ok" }

export interface DailyCandles {
    c: number[];  // Close
    h: number[];  // High
    l: number[];  // Low
    o: number[];  // Open
    v: number[];  // Volume
    t: number[];  // Timestamp
}

export class IndicatorService {
    static computeSMA(data: number[], period: number): number | null {
        if (data.length < period) return null;
        const slice = data.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / period;
    }

    static computeRSI(data: number[], period = 14): number | null {
        if (data.length < period + 1) return null;
        let gains = 0;
        let losses = 0;
        for (let i = data.length - period; i < data.length; i++) {
            const diff = data[i] - data[i - 1];
            if (diff > 0) gains += diff;
            else losses -= diff;
        }
        let avgGain = gains / period;
        let avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        let rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    static computeVolatility(data: number[], period = 20): number | null {
        if (data.length < period + 1) return null;
        const slice = data.slice(-period - 1);
        const returns = [];
        for (let i = 1; i < slice.length; i++) {
            returns.push((slice[i] - slice[i - 1]) / slice[i - 1]);
        }
        const mean = returns.reduce((a, b) => a + b, 0) / period;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
        return Math.sqrt(variance) * Math.sqrt(252); // Annualized Volatility
    }

    static computeMaxDrawdown(data: number[], period = 90): number | null {
        if (data.length < period) return null;
        const slice = data.slice(-period);
        let maxPeak = slice[0];
        let maxDrawdown = 0;
        for (let num of slice) {
            if (num > maxPeak) {
                maxPeak = num;
            }
            const drawdown = (maxPeak - num) / maxPeak;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }
        return maxDrawdown;
    }

    static computeAll(candles: DailyCandles) {
        const closes = candles.c;
        if (!closes || closes.length === 0) return null;

        const lastPrice = closes[closes.length - 1];

        const sma20 = this.computeSMA(closes, 20);
        const sma50 = this.computeSMA(closes, 50);
        const sma200 = this.computeSMA(closes, 200);

        let sma20Slope = null;
        if (closes.length >= 21) {
            const prevSma20 = this.computeSMA(closes.slice(0, -1), 20);
            if (sma20 && prevSma20) {
                sma20Slope = (sma20 - prevSma20) / prevSma20;
            }
        }

        const rsi14 = this.computeRSI(closes, 14);
        const vol20 = this.computeVolatility(closes, 20);
        const drawdown90 = this.computeMaxDrawdown(closes, 90);

        return {
            lastPrice,
            sma20,
            sma50,
            sma200,
            sma20Slope,
            rsi14,
            vol20,
            drawdown90
        };
    }
}

export class PredictionService {
    /**
     * Ensemble logical prediction model without AI
     */
    static predict(indicators: any, horizon: 1 | 5 | 20) {
        let score = 0;
        let explanation = [];
        let riskFlags = [];

        const { sma20, sma50, sma20Slope, rsi14, vol20, drawdown90 } = indicators;

        // 1. Trend
        if (sma20 && sma50) {
            if (sma20 > sma50) {
                score += 1;
                explanation.push("Short-term moving average (20d) is above medium-term (50d), indicating an uptrend.");
            } else {
                score -= 1;
                explanation.push("Short-term moving average (20d) is below medium-term (50d), indicating a downtrend.");
            }
        }

        if (sma20Slope !== null) {
            if (sma20Slope > 0) {
                score += 0.5;
                explanation.push("SMA20 slope is positive, reinforcing bullish momentum.");
            } else {
                score -= 0.5;
                explanation.push("SMA20 slope is negative, reinforcing bearish momentum.");
            }
        }

        // 2. Mean Reversion
        if (rsi14 !== null) {
            if (rsi14 < 30) {
                score += 1.5;
                explanation.push(`RSI is oversold (${rsi14.toFixed(1)}), suggesting a potential mean-reversion bounce.`);
            } else if (rsi14 > 70) {
                score -= 1.5;
                explanation.push(`RSI is overbought (${rsi14.toFixed(1)}), suggesting a potential pullback.`);
            } else {
                explanation.push(`RSI is neutral (${rsi14.toFixed(1)}).`);
            }
        }

        // 3. Volatility penalties
        let confidenceMultiplier = 1.0;
        if (vol20 !== null && vol20 > 0.4) { // Highly volatile
            confidenceMultiplier *= 0.6;
            riskFlags.push("High historical volatility detected. Predictions are less reliable.");
        }
        if (drawdown90 !== null && drawdown90 > 0.2) {
            confidenceMultiplier *= 0.8;
            riskFlags.push("Asset recently experienced a drawdown > 20%. Downside momentum may persist.");
        }

        // Output shaping
        // We clamp the base bias score between -3 and +3.
        const clampedScore = Math.max(-3, Math.min(3, score));

        // Base max return per day is arbitrarily scaled for educational purposes
        const dailyScale = 0.002; // 0.2% per day max theoretical drift baseline
        const predictedReturnPct = clampedScore * dailyScale * horizon * 100;

        // Conf is bounded by how strong the score is relative to max (3), adjusted by volatility
        let maxPossibleAbsoluteScore = 3;
        const rawConfidence = Math.abs(clampedScore) / maxPossibleAbsoluteScore;
        const confidence = Math.max(0.1, Math.min(0.95, rawConfidence * confidenceMultiplier));

        const bias = predictedReturnPct > 0 ? 'bullish bias' : predictedReturnPct < 0 ? 'bearish bias' : 'neutral bias';

        const summaryText = `The deterministic ensemble model has a ${bias} for the next ${horizon} days. \n\nFactors:\n- ${explanation.join('\n- ')}\n\nRisk Flags:\n- ${riskFlags.length > 0 ? riskFlags.join('\n- ') : 'None'}`;

        return {
            predictedReturnPct,
            predictedPrice: indicators.lastPrice * (1 + predictedReturnPct / 100),
            confidence,
            explanationText: summaryText
        };
    }
}
