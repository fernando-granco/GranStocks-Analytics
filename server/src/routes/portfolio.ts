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
            averageCost: z.number().nonnegative()
        });
        const { symbol, assetType, quantity, averageCost } = schema.parse(req.body);
        const authUser = req.user as { id: string };

        const pos = await prisma.portfolioPosition.create({
            data: {
                userId: authUser.id,
                symbol,
                assetType,
                quantity,
                averageCost
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
        const authUser = req.user as { id: string };

        const positions = await prisma.portfolioPosition.findMany({
            where: { userId: authUser.id }
        });

        if (positions.length === 0) return [];

        const { PriceHistoryService } = await import('../services/price-history');

        const results = await Promise.all(positions.map(async (p) => {
            const candles = await PriceHistoryService.getCandles(p.symbol, p.assetType as 'STOCK' | 'CRYPTO', 90);
            return { symbol: p.symbol, candles };
        }));

        const dataMap = new Map<number, any>();
        results.forEach(({ symbol, candles }) => {
            if (!candles || (candles as any).s !== 'ok') return;
            const c = candles as any;
            const basePrice = c.c[0];
            for (let i = 0; i < c.t.length; i++) {
                const ts = c.t[i] * 1000;
                const d = new Date(ts);
                d.setUTCHours(0, 0, 0, 0);
                const dayTs = d.getTime();

                if (!dataMap.has(dayTs)) dataMap.set(dayTs, { dateStr: d.toLocaleDateString(), timestamp: dayTs });
                const row = dataMap.get(dayTs);
                row[symbol] = ((c.c[i] - basePrice) / basePrice) * 100;
            }
        });

        return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
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
        const snapshots = await prisma.indicatorSnapshot.findMany({
            where: { symbol: { in: symbols } },
            orderBy: { date: 'desc' },
            distinct: ['symbol']
        });

        if (snapshots.length === 0) return reply.status(400).send({ error: 'No indicator data available for these assets yet.' });

        const promptData = snapshots.map(s => {
            const ind = JSON.parse(s.indicatorsJson);
            return {
                symbol: s.symbol,
                rsi: ind.rsi14,
                trend: ind.sma20 > ind.sma50 ? 'BULLISH' : 'BEARISH',
                volatility: ind.vol20
            };
        });

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
