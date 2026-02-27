import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/cache';
import { z } from 'zod';
import { MarketData } from '../services/market-data';

export default async function portfolioRoutes(server: FastifyInstance) {
    server.addHook('preValidation', server.authenticate);

    // --- Portfolio Management ---

    // List all portfolios
    server.get('/list', async (req: FastifyRequest, reply: FastifyReply) => {
        const authUser = req.user as { id: string };
        return prisma.portfolio.findMany({
            where: { userId: authUser.id },
            orderBy: { createdAt: 'asc' }
        });
    });

    // Create a new portfolio
    server.post('/create', async (req: FastifyRequest, reply: FastifyReply) => {
        const authUser = req.user as { id: string };
        const schema = z.object({
            name: z.string().min(1),
            baseCurrency: z.string().length(3).default('USD')
        });
        const { name, baseCurrency } = schema.parse(req.body);

        return prisma.portfolio.create({
            data: { userId: authUser.id, name, baseCurrency }
        });
    });

    // Delete a portfolio
    server.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
        const authUser = req.user as { id: string };
        const { id } = req.params as { id: string };

        // Delete positions first (or Cascade if DB supports, but SQLite via Prisma needs manual or schema support)
        await prisma.portfolioPosition.deleteMany({ where: { portfolioId: id, userId: authUser.id } });
        await prisma.portfolio.delete({ where: { id, userId: authUser.id } });

        return { success: true };
    });

    // --- Position Management ---

    // List positions for a specific portfolio (or all if none provided)
    server.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
        const authUser = req.user as { id: string };
        const { portfolioId } = req.query as { portfolioId?: string };

        const where: any = { userId: authUser.id };
        if (portfolioId) where.portfolioId = portfolioId;

        const positions = await prisma.portfolioPosition.findMany({
            where,
            orderBy: { acquiredAt: 'desc' }
        });

        // Get portfolio base currency
        let baseCurrency = 'USD';
        if (portfolioId) {
            const pArr = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
            if (pArr) baseCurrency = pArr.baseCurrency;
        }

        const { FXService } = await import('../services/fx');

        const enriched = await Promise.all(positions.map(async (pos) => {
            let currentPrice = pos.averageCost;
            let isInvalid = false;
            let assetCurrency = 'USD';

            try {
                const asset = await prisma.asset.findUnique({ where: { symbol: pos.symbol } });
                assetCurrency = asset?.currency || (pos.assetType === 'CRYPTO' ? 'USD' : 'USD');

                const quote: any = await MarketData.getQuote(pos.symbol, pos.assetType as 'STOCK' | 'CRYPTO');
                if (quote && quote.price) currentPrice = quote.price;
                else isInvalid = true;
            } catch (e) {
                currentPrice = 0;
                isInvalid = true;
            }

            // Convert everything to portfolio's base currency
            const rateAssetToBase = await FXService.getCrossRate(assetCurrency, baseCurrency);

            const currentPriceInBase = currentPrice * rateAssetToBase;
            const costBasisInBase = (pos.averageCost * pos.quantity) * rateAssetToBase;
            const currentValueInBase = isInvalid ? 0 : currentPriceInBase * pos.quantity;

            const unrealizedPnL = isInvalid ? 0 : currentValueInBase - costBasisInBase;
            const pnlPercent = isInvalid ? 0 : (costBasisInBase > 0 ? (unrealizedPnL / costBasisInBase) * 100 : 0);

            return {
                ...pos,
                currency: assetCurrency,
                currentPrice,         // Local
                currentPriceBase: currentPriceInBase,
                currentValue: currentValueInBase,
                unrealizedPnL,
                pnlPercent,
                isInvalid
            };
        }));

        return enriched;
    });

    // Add a new position
    server.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
        const authUser = req.user as { id: string };
        const schema = z.object({
            portfolioId: z.string().uuid(),
            symbol: z.string().min(1),
            assetType: z.enum(['STOCK', 'CRYPTO']),
            quantity: z.number().positive(),
            averageCost: z.number().nonnegative(),
            acquiredAt: z.string().datetime().optional(),
            fees: z.number().nonnegative().optional().default(0)
        });

        const data = schema.parse(req.body);

        // Verify portfolio ownership
        const portfolio = await prisma.portfolio.findUnique({
            where: { id: data.portfolioId, userId: authUser.id }
        });
        if (!portfolio) return reply.status(404).send({ error: 'Portfolio not found' });

        const position = await prisma.portfolioPosition.create({
            data: {
                ...data,
                userId: authUser.id,
                acquiredAt: data.acquiredAt ? new Date(data.acquiredAt) : new Date()
            }
        });

        return position;
    });

    // Delete a position
    server.delete('/position/:id', async (req: FastifyRequest, reply: FastifyReply) => {
        const authUser = req.user as { id: string };
        const { id } = req.params as { id: string };

        await prisma.portfolioPosition.delete({
            where: { id, userId: authUser.id }
        });

        return { success: true };
    });

    // --- Analytics ---

    // Historical Performance
    server.get('/historical', async (req: FastifyRequest, reply: FastifyReply) => {
        const schema = z.object({
            portfolioId: z.string().uuid().optional(),
            range: z.enum(['1M', '3M', '6M', 'YTD', '1Y', 'ALL_TIME']).default('ALL_TIME')
        });
        const { range, portfolioId } = schema.parse(req.query);
        const authUser = req.user as { id: string };

        const where: any = { userId: authUser.id };
        if (portfolioId) where.portfolioId = portfolioId;

        const positions = await prisma.portfolioPosition.findMany({ where });
        if (positions.length === 0) return [];

        let baseCurrency = 'USD';
        if (portfolioId) {
            const p = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
            if (p) baseCurrency = p.baseCurrency;
        }

        let days = 365 * 5;
        if (range === '1M') days = 30;
        else if (range === '3M') days = 90;
        else if (range === '6M') days = 180;
        else if (range === '1Y') days = 365;
        else if (range === 'YTD') {
            const now = new Date();
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            days = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 3600 * 24));
        }

        const { PriceHistoryService } = await import('../services/price-history');
        const { GroupAnalysisEngine } = await import('../services/group-analysis');

        const priceHistories: Record<string, any> = {};
        await Promise.all(positions.map(async (p) => {
            const candles = await PriceHistoryService.getCandles(p.symbol, p.assetType as 'STOCK' | 'CRYPTO', days);
            if (candles && (candles as any).s === 'ok') priceHistories[p.symbol] = candles;
        }));

        const analysis = await GroupAnalysisEngine.analyzeGroup(positions.map(p => ({
            symbol: p.symbol,
            assetType: p.assetType as 'STOCK' | 'CRYPTO',
            quantity: p.quantity,
            averageCost: p.averageCost
        })), priceHistories, baseCurrency);

        return analysis.performance.history.map(h => ({
            timestamp: h.timestamp,
            dateStr: new Date(h.timestamp).toLocaleDateString(),
            totalValue: h.value
        }));
    });

    // Rich Analytical Summary
    server.get('/analytics', async (req: FastifyRequest, reply: FastifyReply) => {
        const { portfolioId } = req.query as { portfolioId?: string };
        const authUser = req.user as { id: string };

        const where: any = { userId: authUser.id };
        if (portfolioId) where.portfolioId = portfolioId;

        const positions = await prisma.portfolioPosition.findMany({ where });
        if (positions.length === 0) return reply.send(null);

        let baseCurrency = 'USD';
        if (portfolioId) {
            const p = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
            if (p) baseCurrency = p.baseCurrency;
        }

        const { PriceHistoryService } = await import('../services/price-history');
        const { GroupAnalysisEngine } = await import('../services/group-analysis');

        const priceHistories: Record<string, any> = {};
        await Promise.all(positions.map(async (p) => {
            const candles = await PriceHistoryService.getCandles(p.symbol, p.assetType as 'STOCK' | 'CRYPTO', 365);
            if (candles && (candles as any).s === 'ok') priceHistories[p.symbol] = candles;
        }));

        const result = await GroupAnalysisEngine.analyzeGroup(positions.map(p => ({
            symbol: p.symbol,
            assetType: p.assetType as 'STOCK' | 'CRYPTO',
            quantity: p.quantity,
            averageCost: p.averageCost
        })), priceHistories, baseCurrency);

        return reply.send(result);
    });

    // AI Analysis
    server.post('/analyze', { config: { rateLimit: { max: 30, timeWindow: '1 hour' } } }, async (req: FastifyRequest, reply: FastifyReply) => {
        const { portfolioId } = req.body as { portfolioId?: string };
        const authUser = req.user as { id: string };

        const config = await prisma.userLLMConfig.findFirst({ where: { userId: authUser.id } });
        if (!config) return reply.status(400).send({ error: 'No active AI Provider configured.' });

        const where: any = { userId: authUser.id };
        if (portfolioId) where.portfolioId = portfolioId;

        const positions = await prisma.portfolioPosition.findMany({ where });
        if (positions.length === 0) return reply.status(400).send({ error: 'Portfolio is empty.' });

        const symbols = positions.map(p => p.symbol);
        const { GroupAnalysisEngine } = await import('../services/group-analysis');
        const { PriceHistoryService } = await import('../services/price-history');

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

        const promptData = engineResult.positions.map(p => ({
            symbol: p.symbol,
            weight: p.weight,
            pnl: p.pnlPercent
        }));
        promptData.push({ PortfolioRisk: engineResult.risk.volatility, PortfolioDrawdown: engineResult.risk.maxDrawdown } as any);

        const promptJson = JSON.stringify(promptData.slice(0, 50));
        const date = new Date().toISOString().split('T')[0];

        const { LLMService } = await import('../services/llm');
        let language = (req.headers['accept-language'] as string)?.split(',')[0] || 'en';
        const narrative = await LLMService.generateNarrative(config.id, authUser.id, `Portfolio`, date, promptJson, 'CONSENSUS', language);
        return { narrative };
    });
}
