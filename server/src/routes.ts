import { FastifyInstance } from 'fastify';
import { prisma } from './services/cache';
import { FinnhubService } from './services/finnhub';
import { LLMService } from './services/llm';
import { DailyJobService } from './services/scheduler';
import { encryptText } from './utils/crypto';
import z from 'zod';

export async function registerRoutes(server: FastifyInstance) {

    // --- Asset Selection ---
    server.post('/api/user/assets', async (req, reply) => {
        const schema = z.object({ symbol: z.string().toUpperCase() });
        const { symbol } = schema.parse(req.body);

        // Quick validate against Finnhub
        const profile = await FinnhubService.getProfile(symbol);
        if (!profile || Object.keys(profile).length === 0) {
            return reply.status(400).send({ error: 'Invalid symbol or not found on Finnhub.' });
        }

        await prisma.asset.upsert({
            where: { symbol },
            update: { displayName: profile.name || symbol, isActive: true },
            create: { symbol, displayName: profile.name || symbol, exchange: profile.exchange }
        });

        // Simplified for single user mode, normally requires auth token
        let user = await prisma.user.findFirst();
        if (!user) user = await prisma.user.create({ data: {} });

        await prisma.userAssetSelection.create({
            data: { userId: user.id, symbol }
        });

        return { success: true, symbol };
    });

    server.get('/api/user/assets', async () => {
        const user = await prisma.user.findFirst();
        if (!user) return [];
        const selections = await prisma.userAssetSelection.findMany({
            where: { userId: user.id },
            include: { user: false } // Only simple details
        });
        return selections;
    });

    server.delete('/api/user/assets/:symbol', async (req, reply) => {
        const { symbol } = req.params as { symbol: string };
        const user = await prisma.user.findFirst();
        if (!user) return reply.status(404).send();

        // Delete from selection
        await prisma.userAssetSelection.deleteMany({
            where: { userId: user.id, symbol }
        });
        return { success: true };
    });

    // --- Market Data Pull-through (Proxy to Cache/Finnhub) ---
    server.get('/api/data/quote', async (req, reply) => {
        const schema = z.object({ symbol: z.string().toUpperCase() });
        const { symbol } = schema.parse(req.query);
        const data = await FinnhubService.getQuote(symbol);
        return data;
    });

    // --- AI Configuration ---
    server.post('/api/settings/llm', async (req, reply) => {
        const schema = z.object({
            name: z.string(),
            provider: z.enum(['OPENAI', 'GEMINI', 'DEEPSEEK', 'OPENAI_COMPAT']),
            apiKey: z.string().min(1),
            model: z.string(),
            baseUrl: z.string().optional()
        });

        const { name, provider, apiKey, model, baseUrl } = schema.parse(req.body);
        let user = await prisma.user.findFirst();
        if (!user) user = await prisma.user.create({ data: {} });

        const encryptedApiKey = encryptText(apiKey);
        const keyLast4 = apiKey.length > 4 ? apiKey.slice(-4) : apiKey;

        const config = await prisma.userLLMConfig.create({
            data: {
                userId: user.id,
                name,
                provider,
                model,
                baseUrl,
                encryptedApiKey,
                keyLast4
            }
        });

        return { id: config.id, name: config.name, provider: config.provider, keyLast4: config.keyLast4 };
    });

    server.get('/api/settings/llm', async (req, reply) => {
        let user = await prisma.user.findFirst();
        if (!user) return [];

        const configs = await prisma.userLLMConfig.findMany({
            where: { userId: user.id },
            select: { id: true, name: true, provider: true, model: true, keyLast4: true, baseUrl: true }
        });
        return configs;
    });

    // --- Deterministic Outputs API ---
    server.get('/api/overview/today', async (req, reply) => {
        const user = await prisma.user.findFirst();
        if (!user) return [];

        const selections = await prisma.userAssetSelection.findMany({ where: { userId: user.id } });
        const symbols = selections.map(s => s.symbol);

        // Get latest predictions and indicators for selected symbols
        const results = await Promise.all(symbols.map(async sym => {
            const pred = await prisma.predictionSnapshot.findMany({
                where: { symbol: sym },
                orderBy: { date: 'desc' },
                take: 3 // up to 3 horizons
            });
            const ind = await prisma.indicatorSnapshot.findFirst({
                where: { symbol: sym },
                orderBy: { date: 'desc' }
            });
            return { symbol: sym, prediction: pred, indicators: ind };
        }));

        return results;
    });


    // --- AI Generation Orchestration ---
    server.post('/api/ai/generate', async (req, reply) => {
        const schema = z.object({
            date: z.string(),
            symbols: z.array(z.string()),
            llmConfigIds: z.array(z.string()),
            force: z.boolean().optional()
        });
        const { date, symbols, llmConfigIds, force } = schema.parse(req.body);

        let user = await prisma.user.findFirst();
        if (!user) return reply.status(400).send({ error: "No user found." });

        const results: any[] = [];

        // For each selected model, generate narratives side-by-side
        for (const configId of llmConfigIds) {
            for (const symbol of symbols) {
                // Check if already exists unless forced
                if (!force) {
                    const existing = await prisma.aiNarrative.findFirst({
                        where: { llmConfigId: configId, symbol, date }
                    });
                    if (existing) {
                        results.push(existing);
                        continue;
                    }
                }

                // Fetch deterministic context from DB
                const context = await prisma.predictionSnapshot.findFirst({
                    where: { symbol, date, horizonDays: 20 }
                });

                if (!context) continue; // No base context to generate from

                const narrativeText = await LLMService.generateNarrative(configId, symbol, date, context.explanationText);

                const config = await prisma.userLLMConfig.findUnique({ where: { id: configId } });

                const narrative = await prisma.aiNarrative.create({
                    data: {
                        userId: user.id,
                        symbol,
                        date,
                        llmConfigId: configId,
                        contentText: narrativeText,
                        providerUsed: config!.provider,
                        modelUsed: config!.model
                    }
                });

                results.push(narrative);
            }
        }

        return results;
    });

    // --- Admin ---
    server.post('/api/admin/run-daily', async (req, reply) => {
        const schema = z.object({ date: z.string().optional() });
        const { date } = schema.parse(req.query);

        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${process.env.ADMIN_JOB_TOKEN}`) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        // Fire-and-forget job execution internally
        setImmediate(() => {
            DailyJobService.runDailyJob(date).catch(console.error);
        });

        return { status: "Job queued" };
    });
}
