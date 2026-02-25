import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/cache';
import { FinnhubService } from '../services/finnhub';
import { BinanceProvider } from '../services/providers/binance';
import { LLMService } from '../services/llm';
import { PriceHistoryService } from '../services/price-history';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

const DefinitionSchema = z.object({
    symbols: z.array(z.any()).optional(),
    q: z.string().optional(),
    sector: z.string().optional(),
    industry: z.string().optional(),
    exchange: z.string().optional()
});

interface FinDBAsset {
    symbol: string;
    assetType?: string;
    name: string;
    exchange: string;
    sector: string;
    industry: string;
    country: string;
}

// Lazy load the mock/lightweight FinanceDB file
let financeDbCache: FinDBAsset[] | null = null;
async function getFinanceDb(): Promise<FinDBAsset[]> {
    if (financeDbCache) return financeDbCache;
    try {
        const p = path.join(__dirname, '..', '..', 'data', 'finance_db.json');
        financeDbCache = JSON.parse(await fs.promises.readFile(p, 'utf-8'));
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
        // Explicitly demand authentication for this potentially expensive public-facing route
        await server.authenticate(req as any, reply as any);

        const schema = z.object({
            q: z.string().optional(),
            sector: z.string().optional(),
            industry: z.string().optional(),
            exchange: z.string().optional()
        });
        const query = schema.parse(req.query);
        const db = await getFinanceDb();

        let results: FinDBAsset[] = [];

        // If searching by name/symbol, hit Finnhub for stocks and Binance for crypto
        if (query.q) {
            try {
                // Fetch in parallel
                const [fhRes, binRes] = await Promise.all([
                    FinnhubService.search(query.q),
                    BinanceProvider.search(query.q)
                ]);

                if (fhRes && fhRes.result) {
                    const fhResults = fhRes.result.filter((r: any) => !r.symbol.includes('.') && r.type !== 'Index');

                    // Map Finnhub matches to our structural type, enriching with local DB if it exists
                    const stockMatches = fhResults.map((r: any) => {
                        const localItem = db.find(d => d.symbol === r.symbol);
                        return {
                            symbol: r.symbol,
                            assetType: 'STOCK',
                            name: r.description || r.symbol,
                            exchange: localItem?.exchange || 'US Market',
                            sector: localItem?.sector || 'Unknown',
                            industry: localItem?.industry || 'Unknown',
                            country: localItem?.country || 'US'
                        };
                    });
                    results.push(...stockMatches);
                }

                if (binRes && binRes.length > 0) {
                    const cryptoMatches = binRes.map((r: any) => ({
                        symbol: r.symbol,
                        assetType: 'CRYPTO',
                        name: r.description,
                        exchange: 'Binance',
                        sector: 'Crypto',
                        industry: 'Crypto',
                        country: 'Global'
                    }));
                    results.push(...cryptoMatches);
                }

                // Sort results to prioritize exact symbol matches
                const lowerQ = query.q.toLowerCase();
                results.sort((a, b) => {
                    if (a.symbol.toLowerCase() === lowerQ) return -1;
                    if (b.symbol.toLowerCase() === lowerQ) return 1;
                    return 0;
                });
            } catch (e) {
                console.error("Finnhub/Binance search failed, falling back to local DB", e);
                const lowerQ = query.q.toLowerCase();
                results = db.filter(a => a.symbol.toLowerCase().includes(lowerQ) || a.name.toLowerCase().includes(lowerQ));
            }
        } else {
            // No query string, just filtering the master list by category
            results = db;
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
        const db = await getFinanceDb();
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

    server.get('/universes/:id/resolve', async (req: FastifyRequest, reply: FastifyReply) => {
        const authUser = req.user as { id: string };
        const { id } = req.params as { id: string };

        const universe = await prisma.universe.findFirst({
            where: { id, userId: authUser.id }
        });
        if (!universe) return reply.status(404).send({ error: 'Universe not found' });

        let criteria: z.infer<typeof DefinitionSchema>;
        try {
            const rawJson = JSON.parse(universe.definitionJson);
            criteria = DefinitionSchema.parse(rawJson);
        } catch {
            return reply.status(400).send({ error: 'Malformed definitionJson in Universe' });
        }

        const db = await getFinanceDb();
        let results: FinDBAsset[] = [];

        // Support for manually constructed Watchlists (array of symbols)
        if (Array.isArray(criteria.symbols)) {
            results = criteria.symbols.map((symbolObj: any) => {
                const isCrypto = symbolObj.assetType === 'CRYPTO';
                const localItem = !isCrypto ? db.find(d => d.symbol === symbolObj.symbol) : undefined;
                return {
                    symbol: symbolObj.symbol,
                    assetType: symbolObj.assetType,
                    name: localItem?.name || symbolObj.symbol,
                    exchange: isCrypto ? 'Binance' : (localItem?.exchange || 'US Market'),
                    sector: isCrypto ? 'Crypto' : (localItem?.sector || 'Unknown'),
                    industry: isCrypto ? 'Crypto' : (localItem?.industry || 'Unknown'),
                    country: isCrypto ? 'Global' : (localItem?.country || 'US')
                };
            });
            return { universe, assets: results };
        }

        if (criteria.q) {
            try {
                const fhRes = await FinnhubService.search(criteria.q);
                if (fhRes && fhRes.result) {
                    const fhResults = fhRes.result.filter((r: any) => !r.symbol.includes('.') && r.type !== 'Index');
                    results = fhResults.map((r: any) => {
                        const localItem = db.find(d => d.symbol === r.symbol);
                        return {
                            symbol: r.symbol,
                            assetType: 'STOCK',
                            name: r.description || r.symbol,
                            exchange: localItem?.exchange || 'US Market',
                            sector: localItem?.sector || 'Unknown',
                            industry: localItem?.industry || 'Unknown',
                            country: localItem?.country || 'US'
                        };
                    });
                }
            } catch (e) {
                const lowerQ = criteria.q.toLowerCase();
                results = db.filter(a => a.symbol.toLowerCase().includes(lowerQ) || a.name.toLowerCase().includes(lowerQ));
            }
        } else {
            results = db;
        }

        if (criteria.sector !== undefined) results = results.filter(a => a.sector.toLowerCase() === criteria.sector!.toLowerCase());
        if (criteria.industry !== undefined) results = results.filter(a => a.industry.toLowerCase() === criteria.industry!.toLowerCase());
        if (criteria.exchange !== undefined) results = results.filter(a => a.exchange.toLowerCase() === criteria.exchange!.toLowerCase());

        setImmediate(() => {
            import('../services/history-queue').then(q => {
                results.forEach((r: any) => q.HistoryWarmQueue.enqueue(r.symbol, r.assetType || 'STOCK', 'universe_resolve').catch(() => { }));
            }).catch(() => { });
        });

        return { universe, assets: results };
    });

    server.post('/universes/:id/analyze', async (req: FastifyRequest, reply: FastifyReply) => {
        const authUser = req.user as { id: string };
        const { id } = req.params as { id: string };

        const universe = await prisma.universe.findFirst({
            where: { id, userId: authUser.id }
        });
        if (!universe) return reply.status(404).send({ error: 'Universe not found' });

        // Get the first available AI provider for this user
        const config = await prisma.userLLMConfig.findFirst({
            where: { userId: authUser.id }
        });
        if (!config) return reply.status(400).send({ error: 'No active AI Provider configured. Please add one in Settings.' });

        // Resolve assets (reusing logic from resolve route)
        let criteria: z.infer<typeof DefinitionSchema>;
        try {
            const rawJson = JSON.parse(universe.definitionJson);
            criteria = DefinitionSchema.parse(rawJson);
        } catch {
            return reply.status(400).send({ error: 'Malformed definitionJson in Universe' });
        }

        const db = await getFinanceDb();
        let results: FinDBAsset[] = [];

        // Support for manually constructed Watchlists (array of symbols)
        if (Array.isArray(criteria.symbols)) {
            results = criteria.symbols.map((symbolObj: any) => {
                const isCrypto = symbolObj.assetType === 'CRYPTO';
                const localItem = !isCrypto ? db.find((d: any) => d.symbol === symbolObj.symbol) : undefined;
                return {
                    symbol: symbolObj.symbol,
                    assetType: symbolObj.assetType,
                    name: localItem?.name || symbolObj.symbol,
                    exchange: isCrypto ? 'Binance' : (localItem?.exchange || 'US Market'),
                    sector: isCrypto ? 'Crypto' : (localItem?.sector || 'Unknown'),
                    industry: isCrypto ? 'Crypto' : (localItem?.industry || 'Unknown'),
                    country: isCrypto ? 'Global' : (localItem?.country || 'US')
                };
            });
        } else if (criteria.q) {
            try {
                const fhRes = await FinnhubService.search(criteria.q);
                if (fhRes && fhRes.result) {
                    const fhResults = fhRes.result.filter((r: any) => !r.symbol.includes('.') && r.type !== 'Index');
                    results = fhResults.map((r: any) => ({ symbol: r.symbol, name: r.description || r.symbol, exchange: 'US', sector: 'N/A', industry: 'N/A', country: 'US' }));
                }
            } catch (e) {
                const lowerQ = criteria.q.toLowerCase();
                results = db.filter(a => a.symbol.toLowerCase().includes(lowerQ) || a.name.toLowerCase().includes(lowerQ));
            }
        } else {
            results = db;
        }

        if (criteria.sector !== undefined) results = results.filter(a => a.sector.toLowerCase() === criteria.sector!.toLowerCase());
        if (criteria.industry !== undefined) results = results.filter(a => a.industry.toLowerCase() === criteria.industry!.toLowerCase());
        if (criteria.exchange !== undefined) results = results.filter(a => a.exchange.toLowerCase() === criteria.exchange!.toLowerCase());

        if (results.length === 0) return reply.status(400).send({ error: 'Universe is empty.' });

        // Get latest indicators for these symbols
        const symbols = results.map(r => r.symbol);
        const snapshots = await prisma.indicatorSnapshot.findMany({
            where: { symbol: { in: symbols } },
            orderBy: { date: 'desc' },
            distinct: ['symbol']
        });

        if (snapshots.length === 0) return reply.status(400).send({ error: 'No indicator data available for these assets yet. Wait for the daily job to complete.' });

        const promptData = snapshots.map(s => {
            const ind = JSON.parse(s.indicatorsJson);
            return {
                symbol: s.symbol,
                rsi: ind.rsi14,
                trend: ind.sma20 > ind.sma50 ? 'BULLISH' : 'BEARISH',
                volatility: ind.vol20
            };
        });

        // Limit to 50 for prompt size
        const promptJson = JSON.stringify(promptData.slice(0, 50));
        const date = new Date().toISOString().split('T')[0];

        try {
            // Sanitize language
            let language = (req.headers['accept-language'] as string)?.split(',')[0] || 'en';
            if (!['en', 'pt-BR', 'es', 'fr', 'de'].includes(language)) {
                language = 'en';
            }

            const narrativeText = await LLMService.generateNarrative(config.id, authUser.id, `Group: ${universe.name} `, date, promptJson, 'CONSENSUS', language);

            const narrative = await prisma.aiNarrative.create({
                data: {
                    userId: authUser.id,
                    symbol: `Group: ${universe.name}`,
                    date,
                    llmConfigId: config.id,
                    contentText: narrativeText,
                    providerUsed: config.provider,
                    modelUsed: config.model
                }
            });
            return { narrative };
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // Save ordering directly into the customized array
    server.put('/universes/:id/reorder', { preValidation: [server.authenticate] }, async (req, reply) => {
        const { id } = req.params as { id: string };
        const authUser = req.user as { id: string };

        const schema = z.array(z.object({
            symbol: z.string(),
            assetType: z.string()
        }));
        const newSymbols = schema.parse(req.body);

        const universe = await prisma.universe.findFirst({ where: { id, userId: authUser.id } });
        if (!universe) return reply.status(404).send({ error: 'Not found' });

        let criteria: z.infer<typeof DefinitionSchema>;
        try {
            const rawJson = JSON.parse(universe.definitionJson);
            criteria = DefinitionSchema.parse(rawJson);
        } catch {
            return reply.status(400).send({ error: 'Malformed definitionJson in Universe' });
        }
        if (!Array.isArray(criteria.symbols)) {
            return reply.status(400).send({ error: 'Can only reorder manually created Array-based universes' });
        }

        criteria.symbols = newSymbols;
        await prisma.universe.update({
            where: { id },
            data: { definitionJson: JSON.stringify(criteria) }
        });

        return { success: true };
    });

    server.get('/universes/:id/historical', { preValidation: [server.authenticate] }, async (req, reply) => {
        const { id } = req.params as { id: string };
        const authUser = req.user as { id: string };

        const universe = await prisma.universe.findFirst({ where: { id, userId: authUser.id } });
        if (!universe) return reply.status(404).send({ error: 'Not found' });

        let criteria: z.infer<typeof DefinitionSchema>;
        try {
            const rawJson = JSON.parse(universe.definitionJson);
            criteria = DefinitionSchema.parse(rawJson);
        } catch {
            return reply.status(400).send({ error: 'Malformed definitionJson in Universe' });
        }
        if (!Array.isArray(criteria.symbols)) return [];

        const results = await Promise.all(criteria.symbols.map(async (s: any) => {
            const candles = await PriceHistoryService.getCandles(s.symbol, s.assetType || 'STOCK', 90);
            return { symbol: s.symbol, candles };
        }));

        // Normalize time series
        const dataMap = new Map<number, any>();
        results.forEach(({ symbol, candles }) => {
            if (!candles || (candles as any).s !== 'ok') return;
            const c = candles as any;
            const basePrice = c.c[0]; // first close price
            for (let i = 0; i < c.t.length; i++) {
                const ts = c.t[i] * 1000;
                // Get start of day strictly
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

    server.get('/universes/:id/overview', { preValidation: [server.authenticate] }, async (req, reply) => {
        const { id } = req.params as { id: string };
        const authUser = req.user as { id: string };

        const universe = await prisma.universe.findFirst({ where: { id, userId: authUser.id } });
        if (!universe) return reply.status(404).send({ error: 'Universe not found' });

        let criteria: z.infer<typeof DefinitionSchema>;
        try {
            const rawJson = JSON.parse(universe.definitionJson);
            criteria = DefinitionSchema.parse(rawJson);
        } catch {
            return reply.status(400).send({ error: 'Malformed definitionJson in Universe' });
        }
        const symbols = Array.isArray(criteria.symbols) ? criteria.symbols.map((s: any) => s.symbol) : [];

        const assets = await prisma.asset.findMany({
            where: { symbol: { in: symbols } }
        });
        const assetMap = new Map(assets.map(a => [a.symbol, a.type]));

        const results = await Promise.all(symbols.map(async (sym: string) => {
            const pred = await prisma.predictionSnapshot.findMany({
                where: { symbol: sym },
                orderBy: { date: 'desc' },
                take: 3
            });
            const ind = await prisma.indicatorSnapshot.findFirst({
                where: { symbol: sym },
                orderBy: { date: 'desc' }
            });
            return { symbol: sym, assetType: assetMap.get(sym) || 'STOCK', prediction: pred, indicators: ind };
        }));

        return results;
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
