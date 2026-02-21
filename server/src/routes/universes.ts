import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/cache';
import z from 'zod';
import * as fs from 'fs';
import * as path from 'path';

interface FinDBAsset {
    symbol: string;
    name: string;
    exchange: string;
    sector: string;
    industry: string;
    country: string;
}

// Lazy load the mock/lightweight FinanceDB file
let financeDbCache: FinDBAsset[] | null = null;
function getFinanceDb(): FinDBAsset[] {
    if (financeDbCache) return financeDbCache;
    try {
        const p = path.join(__dirname, '..', '..', 'data', 'finance_db.json');
        financeDbCache = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return financeDbCache!;
    } catch {
        // Fallback if not seeded
        return [];
    }
}

export default async function universeRoutes(server: FastifyInstance) {
    server.addHook('preValidation', server.authenticate);

    // --- Advanced Symbol Search & Metadata Filtering ---
    server.get('/symbols/search', async (req: FastifyRequest, reply: FastifyReply) => {
        const schema = z.object({
            q: z.string().optional(),
            sector: z.string().optional(),
            industry: z.string().optional(),
            exchange: z.string().optional()
        });
        const query = schema.parse(req.query);
        const db = getFinanceDb();

        let results = db;

        if (query.q) {
            const lowerQ = query.q.toLowerCase();
            results = results.filter(a => a.symbol.toLowerCase().includes(lowerQ) || a.name.toLowerCase().includes(lowerQ));
        }
        if (query.sector) {
            results = results.filter(a => a.sector.toLowerCase() === query.sector!.toLowerCase());
        }
        if (query.industry) {
            results = results.filter(a => a.industry.toLowerCase() === query.industry!.toLowerCase());
        }
        if (query.exchange) {
            results = results.filter(a => a.exchange.toLowerCase() === query.exchange!.toLowerCase());
        }

        // Return up to 50 matches to keep payload light
        return results.slice(0, 50);
    });

    server.get('/symbols/metadata-options', async (req, reply) => {
        const db = getFinanceDb();
        const sectors = Array.from(new Set(db.map(a => a.sector))).filter(Boolean).sort();
        const industries = Array.from(new Set(db.map(a => a.industry))).filter(Boolean).sort();
        const exchanges = Array.from(new Set(db.map(a => a.exchange))).filter(Boolean).sort();

        return { sectors, industries, exchanges };
    });

    // --- Custom Universes ---
    server.get('/universes', async (req: FastifyRequest, reply: FastifyReply) => {
        const authUser = req.user as { id: string };
        const universes = await prisma.universe.findMany({
            where: { userId: authUser.id },
            orderBy: { createdAt: 'desc' }
        });
        return universes;
    });

    server.post('/universes', async (req: FastifyRequest, reply: FastifyReply) => {
        const authUser = req.user as { id: string };
        const schema = z.object({
            name: z.string().min(1).max(50),
            universeType: z.enum(['STOCK', 'CRYPTO']),
            definitionJson: z.string() // Could be list of symbols or "SECTOR:Technology"
        });
        const { name, universeType, definitionJson } = schema.parse(req.body);

        const u = await prisma.universe.create({
            data: { userId: authUser.id, name, universeType, definitionJson }
        });
        return u;
    });

    server.delete('/universes/:id', async (req: FastifyRequest, reply: FastifyReply) => {
        const authUser = req.user as { id: string };
        const { id } = req.params as { id: string };

        await prisma.universe.deleteMany({
            where: { id, userId: authUser.id }
        });
        return { success: true };
    });
}
