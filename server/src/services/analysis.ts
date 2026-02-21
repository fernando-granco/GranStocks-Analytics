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

    static computeVolatilityAndRiskMetrics(data: number[], period = 20): { vol: number, sharpe: number, sortino: number } | null {
        if (data.length < period + 1) return null;
        const slice = data.slice(-period - 1);
        const returns = [];
        const downsideReturns = [];

        for (let i = 1; i < slice.length; i++) {
            const ret = (slice[i] - slice[i - 1]) / slice[i - 1];
            returns.push(ret);
            if (ret < 0) downsideReturns.push(ret);
        }

        const mean = returns.reduce((a, b) => a + b, 0) / period;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
        const vol = Math.sqrt(variance) * Math.sqrt(252); // Annualized Volatility

        const downsideVariance = downsideReturns.length > 0
            ? downsideReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / downsideReturns.length
            : 0;
        const downsideVol = Math.sqrt(downsideVariance) * Math.sqrt(252);

        // Proxy risk free rate of 4% annualized
        const rfr = 0.04;
        const annualizedReturn = mean * 252;

        const sharpe = vol > 0 ? (annualizedReturn - rfr) / vol : 0;
        const sortino = downsideVol > 0 ? (annualizedReturn - rfr) / downsideVol : sharpe;

        return { vol: vol, sharpe, sortino };
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

    static computeEMA(data: number[], period: number): number | null {
        if (data.length < period) return null;
        const k = 2 / (period + 1);
        let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period; // Start with SMA
        for (let i = period; i < data.length; i++) {
            ema = (data[i] - ema) * k + ema;
        }
        return ema;
    }

    static computeMACD(data: number[]): { macd: number, signal: number, hist: number } | null {
        if (data.length < 26) return null;
        const ema12 = this.computeEMA(data, 12);
        const ema26 = this.computeEMA(data, 26);
        if (!ema12 || !ema26) return null;
        const macd = ema12 - ema26;

        // Signal is 9-day EMA of MACD
        // To be accurate we need the MACD series. For simply getting current MACD:
        const macdSeries = [];
        let curEma12 = data.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
        let curEma26 = data.slice(0, 26).reduce((a, b) => a + b, 0) / 26;
        for (let i = 26; i < data.length; i++) {
            curEma12 = (data[i] - curEma12) * (2 / 13) + curEma12;
            curEma26 = (data[i] - curEma26) * (2 / 27) + curEma26;
            macdSeries.push(curEma12 - curEma26);
        }
        const signal = this.computeEMA(macdSeries, 9) || 0;
        return { macd, signal, hist: macd - signal };
    }

    static computeBollingerBands(data: number[], period = 20): { upper: number, middle: number, lower: number } | null {
        if (data.length < period) return null;
        const slice = data.slice(-period);
        const sma = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        return { upper: sma + stdDev * 2, middle: sma, lower: sma - stdDev * 2 };
    }

    static computeATR(candles: DailyCandles, period = 14): number | null {
        const { c, h, l } = candles;
        if (c.length < period + 1) return null;
        const trs = [];
        for (let i = 1; i < c.length; i++) {
            const tr = Math.max(
                h[i] - l[i],
                Math.abs(h[i] - c[i - 1]),
                Math.abs(l[i] - c[i - 1])
            );
            trs.push(tr);
        }
        // Simplified ATR is just SMA of TR
        return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
    }

    static computeStochastic(candles: DailyCandles, period = 14): { k: number, d: number } | null {
        const { c, h, l } = candles;
        if (c.length < period + 3) return null;

        const calcK = (idx: number) => {
            const highest = Math.max(...h.slice(idx - period + 1, idx + 1));
            const lowest = Math.min(...l.slice(idx - period + 1, idx + 1));
            return ((c[idx] - lowest) / (highest - lowest + 0.0001)) * 100;
        };

        const currentK = calcK(c.length - 1);
        const k1 = calcK(c.length - 2);
        const k2 = calcK(c.length - 3);

        const d = (currentK + k1 + k2) / 3; // 3-period SMA of %K
        return { k: currentK, d };
    }

    static computeDataQualityScore(candles: DailyCandles): number {
        let score = 100;
        const { c, o, h, l } = candles;
        if (c.length < 2) return 0;

        // Check for missing data (zeros)
        const zeros = c.filter(x => x === 0).length;
        if (zeros > 0) score -= (zeros * 5);

        // Check for extreme gaps (suspicious split/dividend missing adjustments)
        for (let i = 1; i < c.length; i++) {
            const gap = Math.abs(c[i] - c[i - 1]) / c[i - 1];
            if (gap > 0.5) score -= 10; // > 50% jump in one day is usually a bad data artifact for normal stocks
        }

        // Check High/Low bounding Open/Close
        let boundingErrors = 0;
        for (let i = 0; i < c.length; i++) {
            if (h[i] < c[i] || h[i] < o[i] || l[i] > c[i] || l[i] > o[i]) boundingErrors++;
        }
        score -= (boundingErrors * 2);

        return Math.max(0, Math.min(100, score));
    }

    static computeAll(candles: DailyCandles) {
        const closes = candles.c;
        if (!closes || closes.length === 0) return null;

        const lastPrice = closes[closes.length - 1];

        const sma20 = this.computeSMA(closes, 20);
        const sma50 = this.computeSMA(closes, 50);
        const sma200 = this.computeSMA(closes, 200);

        const ema20 = this.computeEMA(closes, 20);
        const ema50 = this.computeEMA(closes, 50);

        let sma20Slope = null;
        if (closes.length >= 21) {
            const prevSma20 = this.computeSMA(closes.slice(0, -1), 20);
            if (sma20 && prevSma20) {
                sma20Slope = (sma20 - prevSma20) / prevSma20;
            }
        }

        const rsi14 = this.computeRSI(closes, 14);
        const riskMetrics = this.computeVolatilityAndRiskMetrics(closes, 20);
        const drawdown90 = this.computeMaxDrawdown(closes, 90);

        const macd = this.computeMACD(closes);
        const bollinger = this.computeBollingerBands(closes, 20);
        const atr14 = this.computeATR(candles, 14);
        const stochastic = this.computeStochastic(candles, 14);

        const dataQualityScore = this.computeDataQualityScore(candles);

        return {
            lastPrice,
            sma20,
            sma50,
            sma200,
            ema20,
            ema50,
            sma20Slope,
            rsi14,
            vol20: riskMetrics ? riskMetrics.vol : null,
            sharpe: riskMetrics ? riskMetrics.sharpe : null,
            sortino: riskMetrics ? riskMetrics.sortino : null,
            drawdown90,
            macd,
            bollinger,
            atr14,
            stochastic,
            dataQualityScore
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

    /**
     * Translates raw numeric indicators into human-readable text for LLM injection
     */
    static generateEvidencePack(indicators: any): string {
        if (!indicators) return "No data available.";

        const parts = [];
        parts.push(`Current Price: $${indicators.lastPrice?.toFixed(2)}`);

        if (indicators.sma20 && indicators.sma50) {
            parts.push(`Moving Averages: The 20-day SMA is at $${indicators.sma20.toFixed(2)} and the 50-day SMA is at $${indicators.sma50.toFixed(2)}.`);
        }

        if (indicators.macd) {
            parts.push(`MACD: MACD Line is ${indicators.macd.macd.toFixed(3)}, Signal Line is ${indicators.macd.signal.toFixed(3)}, Histogram is ${indicators.macd.hist.toFixed(3)}.`);
        }

        if (indicators.bollinger) {
            parts.push(`Bollinger Bands (20): Upper $${indicators.bollinger.upper.toFixed(2)}, Lower $${indicators.bollinger.lower.toFixed(2)}.`);
        }

        if (indicators.rsi14) {
            parts.push(`RSI (14-day): ${indicators.rsi14.toFixed(1)}`);
        }

        if (indicators.stochastic) {
            parts.push(`Stochastic (14-day): %K is ${indicators.stochastic.k.toFixed(1)}, %D is ${indicators.stochastic.d.toFixed(1)}.`);
        }

        if (indicators.vol20) {
            parts.push(`Volatility (Annualized 20d): ${(indicators.vol20 * 100).toFixed(1)}%`);
        }

        if (indicators.dataQualityScore) {
            parts.push(`Data Quality Score: ${indicators.dataQualityScore} / 100`);
        }

        return parts.join('\n');
    }
}

export class FirmViewService {
    /**
     * Generate simulated deterministic viewpoints for "Firm View Roles".
     */
    static generateFirmViews(indicators: any): Record<string, any> {
        if (!indicators) return {};

        const views: Record<string, any> = {};

        // 1. Technical Analyst
        let techBias = 'Neutral';
        if (indicators.sma20 > indicators.sma50 && indicators.rsi14 < 70) techBias = 'Bullish';
        if (indicators.sma20 < indicators.sma50 && indicators.rsi14 > 40) techBias = 'Bearish';

        views['Technical Analyst'] = {
            bias: techBias,
            key_levels: `SMA20: $${indicators.sma20?.toFixed(2)}, SMA50: $${indicators.sma50?.toFixed(2)}`,
            momentum: indicators.macd?.hist > 0 ? 'Positive' : 'Negative',
            rsi_condition: indicators.rsi14 > 70 ? 'Overbought' : indicators.rsi14 < 30 ? 'Oversold' : 'Neutral'
        };

        // 2. Risk Manager
        let riskLevel = 'Low';
        if (indicators.vol20 > 0.4 || indicators.drawdown90 > 0.2) riskLevel = 'High';
        else if (indicators.vol20 > 0.25 || indicators.drawdown90 > 0.1) riskLevel = 'Medium';

        views['Risk Manager'] = {
            risk_level: riskLevel,
            annualized_volatility: `${(indicators.vol20 * 100)?.toFixed(1)}%`,
            max_drawdown_90d: `${(indicators.drawdown90 * 100)?.toFixed(1)}%`,
            data_quality: `${indicators.dataQualityScore}/100`
        };

        // 3. Quantitative Strategist
        views['Quant Strategist'] = {
            regime: indicators.vol20 > 0.3 ? 'High Volatility' : 'Low Volatility Trend',
            bollinger_position: indicators.lastPrice > indicators.bollinger?.upper ? 'Outside Upper Band' : indicators.lastPrice < indicators.bollinger?.lower ? 'Outside Lower Band' : 'Inside Bands',
            stochastic_k: indicators.stochastic?.k?.toFixed(1)
        };

        return views;
    }
}
