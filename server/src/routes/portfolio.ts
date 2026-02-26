import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/cache';
import { z } from 'zod';
import { MarketData } from '../services/market-data';

export default async function portfolioRoutes(server: FastifyInstance) {
    server.addHook('preValidation', server.authenticate);

    // List all positions & calculate Unrealized P&L
    server.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
        const authUser = req.user as { id: string };
        const positions = await prisma.portfolioPosition.findMany({
            where: { userId: authUser.id },
            orderBy: { acquiredAt: 'desc' }
        });

        // Compute current live value for each (in parallel for speed)
        const enriched = await Promise.all(positions.map(async (pos) => {
            let currentPrice = pos.averageCost; // fallback to cost
            let isInvalid = false;
            try {
                const quote: any = await MarketData.getQuote(pos.symbol, pos.assetType as 'STOCK' | 'CRYPTO');
                if (quote && quote.price) currentPrice = quote.price;
                else isInvalid = true;
            } catch (e) {
                // Quote failed or symbol doesn't exist
                currentPrice = 0;
                isInvalid = true;
            }

            const currentValue = isInvalid ? 0 : currentPrice * pos.quantity;
            const costBasis = pos.averageCost * pos.quantity;
            const unrealizedPnL = isInvalid ? 0 : currentValue - costBasis;
            const pnlPercent = isInvalid ? 0 : (costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0);

            return {
                ...pos,
                currentPrice,
                currentValue,
                unrealizedPnL,
                pnlPercent,
                isInvalid
            };
        }));

        return enriched;
    });

    // Add a new position
    server.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
        const schema = z.object({
            symbol: z.string().toUpperCase(),
            assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK'),
            quantity: z.number().positive(),
            averageCost: z.number().nonnegative(),
            acquiredAt: z.string().datetime(),
            fees: z.number().nonnegative().optional().default(0)
        });
        const { symbol, assetType, quantity, averageCost, acquiredAt, fees } = schema.parse(req.body);
        const authUser = req.user as { id: string };

        const pos = await prisma.portfolioPosition.create({
            data: {
                userId: authUser.id,
                symbol,
                assetType,
                quantity,
                averageCost,
                acquiredAt: new Date(acquiredAt),
                fees
            }
        });

        return pos;
    });

    // Delete a position
    server.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
        const { id } = req.params as { id: string };
        const authUser = req.user as { id: string };

        const existing = await prisma.portfolioPosition.findFirst({
            where: { id, userId: authUser.id }
        });

        if (!existing) return reply.status(404).send({ error: 'Position not found' });

        await prisma.portfolioPosition.delete({ where: { id } });
        return { success: true };
    });

    // Historical Performance for Portfolio
    server.get('/historical', async (req: FastifyRequest, reply: FastifyReply) => {
        const schema = z.object({ range: z.enum(['1M', '3M', '6M', 'YTD', '1Y', 'ALL_TIME']).default('ALL_TIME') });
        const { range } = schema.parse(req.query);
        const authUser = req.user as { id: string };

        const positions = await prisma.portfolioPosition.findMany({
            where: { userId: authUser.id }
        });

        if (positions.length === 0) return [];

        let days = 365 * 5; // Default ALL
        if (range === '1M') days = 30;
        if (range === '3M') days = 90;
        if (range === '6M') days = 180;
        if (range === '1Y') days = 365;
        if (range === 'YTD') {
            const now = new Date();
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            days = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 3600 * 24));
        }

        const { PriceHistoryService } = await import('../services/price-history');

        const results = await Promise.all(positions.map(async (p) => {
            const candles = await PriceHistoryService.getCandles(p.symbol, p.assetType as 'STOCK' | 'CRYPTO', days);
            return { symbol: p.symbol, quantity: p.quantity, acquiredAt: p.acquiredAt.getTime(), candles };
        }));

        const earliestAcquired = Math.min(...positions.map(p => p.acquiredAt.getTime()));

        const dataMap = new Map<number, any>();
        results.forEach(({ symbol, quantity, acquiredAt, candles }) => {
            if (!candles || (candles as any).s !== 'ok') return;
            const c = candles as any;
            const basePrice = c.c[0];
            for (let i = 0; i < c.t.length; i++) {
                const ts = c.t[i] * 1000;
                const d = new Date(ts);
                d.setUTCHours(0, 0, 0, 0);
                const dayTs = d.getTime();

                // Skip dates before the first asset was ever acquired
                if (dayTs < new Date(earliestAcquired).setUTCHours(0, 0, 0, 0)) continue;

                if (!dataMap.has(dayTs)) dataMap.set(dayTs, { dateStr: d.toLocaleDateString(), timestamp: dayTs, totalValue: 0 });
                const row = dataMap.get(dayTs);

                // Keep the % returns for the Portfolio Analysis charting compatibility
                row[symbol] = ((c.c[i] - basePrice) / basePrice) * 100;

                // Add absolute value to the aggregate if owned on this date
                if (dayTs >= (new Date(acquiredAt).setUTCHours(0, 0, 0, 0) || 0)) {
                    row.totalValue += c.c[i] * quantity;
                }
            }
        });

        // Filter out any trailing zeros if there are glitches, but mainly return sorted array
        const sortedArray = Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        return sortedArray;
    });

    // Rich Analytical Summary for Portfolio
    server.get('/analytics', async (req: FastifyRequest, reply: FastifyReply) => {
        const authUser = req.user as { id: string };

        const positions = await prisma.portfolioPosition.findMany({
            where: { userId: authUser.id }
        });

        if (positions.length === 0) return reply.send(null);

        const { PriceHistoryService } = await import('../services/price-history');
        const { GroupAnalysisEngine } = await import('../services/group-analysis');

        // Fetch 1-year history for analytical modeling
        const priceHistories: Record<string, any> = {};
        await Promise.all(positions.map(async (p) => {
            const candles = await PriceHistoryService.getCandles(p.symbol, p.assetType as 'STOCK' | 'CRYPTO', 365);
            if (candles && (candles as any).s === 'ok') {
                priceHistories[p.symbol] = candles;
            }
        }));

        const result = await GroupAnalysisEngine.analyzeGroup(positions.map(p => ({
            symbol: p.symbol,
            assetType: p.assetType as 'STOCK' | 'CRYPTO',
            quantity: p.quantity,
            averageCost: p.averageCost
        })), priceHistories);

        return reply.send(result);
    });

    // Run AI Analysis for Portfolio
    server.post('/analyze', { config: { rateLimit: { max: 30, timeWindow: '1 hour' } } }, async (req: FastifyRequest, reply: FastifyReply) => {
        const authUser = req.user as { id: string };

        const config = await prisma.userLLMConfig.findFirst({
            where: { userId: authUser.id }
        });
        if (!config) return reply.status(400).send({ error: 'No active AI Provider configured. Please add one in Settings.' });

        const positions = await prisma.portfolioPosition.findMany({
            where: { userId: authUser.id }
        });

        if (positions.length === 0) return reply.status(400).send({ error: 'Portfolio is empty.' });

        const symbols = positions.map(p => p.symbol);

        // 1. Try to get Snapshots
        let promptData: any[] = [];
        const threeDaysAgoStr = new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0];
        const snapshots = await prisma.indicatorSnapshot.findMany({
            where: { symbol: { in: symbols }, date: { gte: threeDaysAgoStr } },
            orderBy: { date: 'desc' },
            distinct: ['symbol']
        });

        if (snapshots.length > 0) {
            promptData = snapshots.map(s => {
                const ind = JSON.parse(s.indicatorsJson);
                return {
                    symbol: s.symbol,
                    rsi: ind.rsi14,
                    trend: ind.sma20 > ind.sma50 ? 'BULLISH' : 'BEARISH',
                    volatility: ind.vol20
                };
            });
        } else {
            // 2. Fallback to runtime GroupAnalysisEngine if Cron hasn't run
            const { PriceHistoryService } = await import('../services/price-history');
            const { GroupAnalysisEngine } = await import('../services/group-analysis');
            const priceHistories: Record<string, any> = {};
            await Promise.all(positions.map(async (p) => {
                const candles = await PriceHistoryService.getCandles(p.symbol, p.assetType as 'STOCK' | 'CRYPTO', 365);
                if (candles && (candles as any).s === 'ok') priceHistories[p.symbol] = candles;
            }));

            const engineResult = await GroupAnalysisEngine.analyzeGroup(positions.map(p => ({
                symbol: p.symbol,
                assetType: p.assetType as 'STOCK' | 'CRYPTO',
                quantity: p.quantity,
                averageCost: p.averageCost
            })), priceHistories);

            promptData = engineResult.positions.map(p => ({
                symbol: p.symbol,
                weight: p.weight,
                pnl: p.pnlPercent
            }));
            promptData.push({ PortfolioRisk: engineResult.risk.volatility, PortfolioDrawdown: engineResult.risk.maxDrawdown, BreadthBullish: engineResult.breadth.bullishPercent } as any);
        }

        const promptJson = JSON.stringify(promptData.slice(0, 50));
        const date = new Date().toISOString().split('T')[0];

        try {
            const { LLMService } = await import('../services/llm');
            let language = (req.headers['accept-language'] as string)?.split(',')[0] || 'en';
            if (!['en', 'pt-BR', 'es', 'fr', 'de'].includes(language)) language = 'en';
            const narrative = await LLMService.generateNarrative(config.id, authUser.id, `Group: My Portfolio`, date, promptJson, 'CONSENSUS', language);
            return { narrative };
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
