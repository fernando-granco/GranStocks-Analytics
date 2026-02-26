import { FastifyInstance } from 'fastify';
import { prisma } from '../services/cache';
import z from 'zod';

export default async function demoRoutes(server: FastifyInstance) {

    server.get('/meta', async (req, reply) => {
        const meta = await prisma.demoSnapshotMeta.findFirst();
        if (!meta) {
            return reply.status(404).send({ error: 'Demo snapshots not generated yet.' });
        }
        return meta;
    });

    server.get('/screener/:universe', async (req, reply) => {
        const schema = z.object({ universe: z.enum(['SP500', 'NASDAQ100', 'CRYPTO', 'TSX60', 'IBOV']) });
        const { universe } = schema.parse(req.params);

        const meta = await prisma.demoSnapshotMeta.findFirst();
        if (!meta) return reply.send({ state: null, topCandidates: [] });

        const snapshots = await prisma.demoScreenerSnapshot.findMany({
            where: {
                snapshotAnchorDate: meta.snapshotAnchorDate,
                universeName: universe
            },
            orderBy: { score: 'desc' },
            take: 25
        });

        // Provide a mocked job state
        const state = {
            id: 'demo-' + universe,
            universeType: universe === 'CRYPTO' ? 'CRYPTO' : 'STOCK',
            universeName: universe,
            status: 'COMPLETED',
            cursorIndex: snapshots.length,
            total: snapshots.length,
            lastRunAt: meta.createdAt
        };

        return { state, topCandidates: snapshots };
    });

    server.get('/asset/:assetType/:symbol', async (req, reply) => {
        const schema = z.object({
            symbol: z.string().toUpperCase(),
            assetType: z.enum(['STOCK', 'CRYPTO'])
        });
        const { symbol, assetType } = schema.parse(req.params);

        const meta = await prisma.demoSnapshotMeta.findFirst();
        if (!meta) return reply.status(404).send({ error: 'No demo data available' });

        const snapshot = await prisma.demoAssetSnapshot.findUnique({
            where: {
                snapshotAnchorDate_assetType_symbol: {
                    snapshotAnchorDate: meta.snapshotAnchorDate,
                    assetType,
                    symbol
                }
            }
        });

        if (!snapshot) {
            return reply.status(404).send({ error: `Demo data for ${symbol} not found.` });
        }

        return {
            quote: JSON.parse(snapshot.quoteJson),
            candles: JSON.parse(snapshot.candlesJson),
            indicators: JSON.parse(snapshot.indicatorsJson),
            firmView: JSON.parse(snapshot.firmViewJson),
            riskFlags: JSON.parse(snapshot.riskFlagsJson)
        };
    });
}
