import { z } from 'zod';

export const ScreenerConfigSchema = z.object({
    volatilityThreshold: z.number().min(0).max(200).default(40),
    volatilityPenalty: z.number().min(0).max(50).default(10),
    drawdownThreshold: z.number().min(0).max(100).default(20),
    drawdownPenalty: z.number().min(0).max(50).default(15),
    trendStrengthReward: z.number().min(0).max(50).default(5),
    trendStrengthPenalty: z.number().min(0).max(50).default(5),
    sharpeReward: z.number().min(0).max(50).default(5),
    sortinoReward: z.number().min(0).max(50).default(5)
});

export const PredictConfigSchema = z.object({
    rsiOverbought: z.number().min(50).max(100).default(70),
    rsiOversold: z.number().min(0).max(50).default(30),
    highVolatilityThreshold: z.number().min(0).max(200).default(50),
    severeDrawdownThreshold: z.number().min(0).max(1).default(0.30)
});

export const AnalysisConfigSchema = z.object({
    screener: ScreenerConfigSchema.default({}),
    predict: PredictConfigSchema.default({})
});

export type AnalysisConfigPayload = z.infer<typeof AnalysisConfigSchema>;

export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfigPayload = AnalysisConfigSchema.parse({});
