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
            try {
                const quote: any = await MarketData.getQuote(pos.symbol, pos.assetType as 'STOCK' | 'CRYPTO');
                if (quote && quote.price) currentPrice = quote.price;
            } catch (e) {
                // Ignore API skips
            }

            const currentValue = currentPrice * pos.quantity;
            const costBasis = pos.averageCost * pos.quantity;
            const unrealizedPnL = currentValue - costBasis;
            const pnlPercent = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

            return {
                ...pos,
                currentPrice,
                currentValue,
                unrealizedPnL,
                pnlPercent
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
}
