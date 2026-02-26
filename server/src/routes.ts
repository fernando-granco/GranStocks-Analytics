import { FastifyInstance } from 'fastify';
import { prisma } from './services/cache';
import { MarketData } from './services/market-data';
import { LLMService, validateBaseUrl } from './services/llm';
import { DailyJobService } from './services/scheduler';
import { ScreenerService } from './services/screener';
import { PredictionService, IndicatorService, FirmViewService } from './services/analysis';
import { PriceHistoryService } from './services/price-history';
import { encryptText } from './utils/crypto';
import { toDateString } from './utils/date-helpers';
import z from 'zod';

export async function registerRoutes(server: FastifyInstance) {

    // Helper: derive market from symbol suffix
    function deriveMarket(symbol: string): string {
        if (symbol.endsWith('.TO')) return 'CA';
        if (symbol.endsWith('.SA')) return 'BR';
        return 'US';
    }

    // --- Unified Global Search ---
    server.get('/api/assets/search', { preValidation: [server.authenticate], config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
        const { q } = req.query as { q?: string };
        if (!q || q.length < 2) return [];

        try {
            const fs = require('fs');
            const path = require('path');
            const results: any[] = [];
            const queryUpper = q.toUpperCase();

            // 1. Search finance_db.json (US stocks with names)
            const dbPath = path.join(__dirname, '..', 'data', 'finance_db.json');
            if (fs.existsSync(dbPath)) {
                const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                const matches = data.filter((item: any) =>
                    (item.symbol && item.symbol.toUpperCase().includes(queryUpper)) ||
                    (item.name && item.name.toUpperCase().includes(queryUpper))
                ).map((item: any) => ({
                    symbol: item.symbol,
                    name: item.name,
                    exchange: item.exchange,
                    market: 'US',
                    type: 'STOCK'
                }));
                results.push(...matches);
            }

            // 2. Search TSX60 universe (Canadian stocks)
            const tsxPath = path.join(__dirname, 'data', 'tsx60.json');
            if (fs.existsSync(tsxPath)) {
                const tsxSymbols: string[] = JSON.parse(fs.readFileSync(tsxPath, 'utf8'));
                const tsxMatches = tsxSymbols
                    .filter(sym => sym.toUpperCase().includes(queryUpper))
                    .map(sym => ({ symbol: sym, name: sym.replace('.TO', ''), exchange: 'TSX', market: 'CA', type: 'STOCK' }));
                results.push(...tsxMatches);
            }

            // 3. Search IBOV universe (Brazilian stocks)
            const ibovPath = path.join(__dirname, 'data', 'ibov.json');
            if (fs.existsSync(ibovPath)) {
                const ibovSymbols: string[] = JSON.parse(fs.readFileSync(ibovPath, 'utf8'));
                const ibovMatches = ibovSymbols
                    .filter(sym => sym.toUpperCase().includes(queryUpper))
                    .map(sym => ({ symbol: sym, name: sym.replace('.SA', ''), exchange: 'B3/IBOV', market: 'BR', type: 'STOCK' }));
                results.push(...ibovMatches);
            }

            // 4. If it looks like a crypto pair, add it
            if (queryUpper.endsWith('USDT') || queryUpper === 'BTC' || queryUpper === 'ETH') {
                const cryptoSym = queryUpper.endsWith('USDT') ? queryUpper : `${queryUpper}USDT`;
                results.unshift({ symbol: cryptoSym, name: 'Binance Crypto Pair', exchange: 'CRYPTO', market: 'CRYPTO', type: 'CRYPTO' });
            }

            return results.slice(0, 50); // Hard cap for UI performance
        } catch (e) {
            console.error('Search error', e);
            return [];
        }
    });

    // --- Tracked Asset Selection ---
    server.post('/api/tracked-assets', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.object({
            symbol: z.string().toUpperCase().min(1).max(20).regex(/^[A-Z0-9.-]+$/),
            assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK')
        });
        const { symbol, assetType } = schema.parse(req.body);

        // Quick validate against MarketData
        let displayName = symbol;
        const market = assetType === 'CRYPTO' ? 'CRYPTO' : deriveMarket(symbol);
        let exchange = market === 'CA' ? 'TSX' : market === 'BR' ? 'B3/IBOV' : 'US Market';
        let currency = market === 'CA' ? 'CAD' : market === 'BR' ? 'BRL' : 'USD';

        if (assetType === 'STOCK') {
            const profile = await MarketData.getOverview(symbol, assetType);
            if (!profile || Object.keys(profile).length === 0) {
                return reply.status(400).send({ error: 'Invalid symbol or not found.' });
            }
            displayName = profile.Name || profile.name || symbol;
            exchange = profile.Exchange || profile.exchange || '';
        } else {
            try {
                // Verify crypto symbol exists by quoting it
                await MarketData.getQuote(symbol, assetType);
                exchange = 'Binance';
            } catch (e) {
                return reply.status(400).send({ error: 'Invalid crypto symbol or not found on Binance.' });
            }
        }

        await prisma.asset.upsert({
            where: { symbol },
            update: { displayName, isActive: true, type: assetType, market },
            create: { symbol, displayName, exchange, type: assetType, market, currency }
        });

        const authUser = req.user as { id: string };

        try {
            await prisma.trackedAsset.create({
                data: { userId: authUser.id, symbol }
            });

            // Auto-trigger background processing for this new asset
            import('./services/history-queue').then(q => q.HistoryWarmQueue.enqueue(symbol, assetType, 'tracked_asset_added')).catch(() => { });

            setImmediate(async () => {
                try {
                    const dateStr = new Intl.DateTimeFormat('en-CA', {
                        timeZone: 'America/Toronto',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    }).format(new Date());
                    await DailyJobService.processAsset({ symbol, type: assetType }, dateStr);
                } catch (e) { console.error('Auto-analyze error:', e); }
            });

            return { success: true, symbol };
        } catch (e) {
            return reply.status(409).send({ error: 'Asset already tracked' });
        }
    });

    server.get('/api/tracked-assets', { preValidation: [server.authenticate] }, async (req, reply) => {
        const authUser = req.user as { id: string };
        const selections = await prisma.trackedAsset.findMany({
            where: { userId: authUser.id },
            include: { user: false } // Only simple details
        });
        return selections;
    });

    server.delete('/api/tracked-assets/:symbol', { preValidation: [server.authenticate] }, async (req, reply) => {
        const { symbol } = req.params as { symbol: string };
        const authUser = req.user as { id: string };

        // Delete from selection
        await prisma.trackedAsset.deleteMany({
            where: { userId: authUser.id, symbol }
        });
        return { success: true };
    });

    server.put('/api/tracked-assets/reorder', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.array(z.object({
            symbol: z.string(),
            order: z.number().int()
        }));
        const items = schema.parse(req.body);
        const authUser = req.user as { id: string };

        // Process sequentially to avoid lock contentions in sqlite
        for (const item of items) {
            await prisma.trackedAsset.updateMany({
                where: { userId: authUser.id, symbol: item.symbol },
                data: { order: item.order }
            });
        }
        return { success: true };
    });

    // --- Market Data Pull-through (Proxy to Cache/Providers) ---
    server.get('/api/data/quote', {
        preValidation: [server.authenticate],
        config: { rateLimit: { max: 120, timeWindow: '1 minute' } }
    }, async (req, reply) => {
        const schema = z.object({ symbol: z.string().toUpperCase(), assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK') });
        const { symbol, assetType } = schema.parse(req.query);
        return await MarketData.getQuote(symbol, assetType);
    });

    server.get('/api/data/candles', {
        preValidation: [server.authenticate],
        config: { rateLimit: { max: 120, timeWindow: '1 minute' } }
    }, async (req, reply) => {
        const schema = z.object({
            symbol: z.string().toUpperCase(),
            assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK'),
            // Using simplified range strings now for MarketData unified router
            range: z.string().default('6m')
        });
        const { symbol, assetType, range } = schema.parse(req.query);
        return await MarketData.getCandles(symbol, assetType, range);
    });

    server.get('/api/data/profile', {
        preValidation: [server.authenticate],
        config: { rateLimit: { max: 60, timeWindow: '1 minute' } }
    }, async (req, reply) => {
        const schema = z.object({ symbol: z.string().toUpperCase(), assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK') });
        const { symbol, assetType } = schema.parse(req.query);
        return await MarketData.getOverview(symbol, assetType);
    });

    server.get('/api/data/metrics', { preValidation: [server.authenticate], config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
        const schema = z.object({ symbol: z.string().toUpperCase(), assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK') });
        const { symbol, assetType } = schema.parse(req.query);
        return await MarketData.getMetrics(symbol, assetType);
    });

    server.get('/api/data/fundamentals', { preValidation: [server.authenticate], config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
        const schema = z.object({ symbol: z.string().toUpperCase(), assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK') });
        const { symbol, assetType } = schema.parse(req.query);
        return await MarketData.getFundamentals(symbol, assetType);
    });

    server.get('/api/data/earnings', { preValidation: [server.authenticate], config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
        const schema = z.object({ symbol: z.string().toUpperCase(), assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK') });
        const { symbol, assetType } = schema.parse(req.query);
        return await MarketData.getEarnings(symbol, assetType);
    });

    server.get('/api/data/news', { preValidation: [server.authenticate], config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
        const schema = z.object({
            symbol: z.string().toUpperCase(),
            assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK')
        });
        const { symbol, assetType } = schema.parse(req.query);
        return await MarketData.getNews(symbol, assetType);
    });

    // --- AI Configuration ---
    server.post('/api/settings/llm', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.object({
            name: z.string().max(100),
            provider: z.enum(['OPENAI', 'ANTHROPIC', 'GEMINI', 'XAI', 'DEEPSEEK', 'GROQ', 'TOGETHER', 'OPENAI_COMPAT']),
            apiKey: z.string().min(1),
            model: z.string(),
            baseUrl: z.string().optional()
        });

        const { name, provider, apiKey, model, baseUrl } = schema.parse(req.body);
        const authUser = req.user as { id: string };

        let validatedBaseUrl = baseUrl;
        if (baseUrl) {
            try {
                validatedBaseUrl = await validateBaseUrl(baseUrl, provider === 'OPENAI_COMPAT');
            } catch (err: any) {
                return reply.status(400).send({ error: err.message });
            }
        }

        const encryptedApiKey = encryptText(apiKey);
        const keyLast4 = apiKey.length > 4 ? apiKey.slice(-4) : apiKey;

        const config = await prisma.userLLMConfig.create({
            data: {
                userId: authUser.id,
                name,
                provider,
                model,
                baseUrl: validatedBaseUrl,
                encryptedApiKey,
                keyLast4
            }
        });

        return { id: config.id, name: config.name, provider: config.provider, keyLast4: config.keyLast4 };
    });

    server.get('/api/settings/llm', { preValidation: [server.authenticate] }, async (req, reply) => {
        const authUser = req.user as { id: string };

        const configs = await prisma.userLLMConfig.findMany({
            where: { userId: authUser.id },
            select: { id: true, name: true, provider: true, model: true, keyLast4: true, baseUrl: true }
        });
        return configs;
    });

    server.delete('/api/settings/llm/:id', { preValidation: [server.authenticate] }, async (req, reply) => {
        const { id } = req.params as { id: string };
        const authUser = req.user as { id: string };

        const config = await prisma.userLLMConfig.findUnique({ where: { id } });
        if (!config || config.userId !== authUser.id) {
            return reply.status(404).send({ error: 'Config not found' });
        }

        await prisma.userLLMConfig.delete({ where: { id } });
        return { success: true };
    });

    // --- User Preferences ---
    server.get('/api/settings/preferences', { preValidation: [server.authenticate] }, async (req, reply) => {
        const authUser = req.user as { id: string };
        const user = await prisma.user.findUnique({ where: { id: authUser.id }, select: { timezone: true } });
        let prefs = await prisma.userPreferences.findUnique({ where: { userId: authUser.id } });

        if (!prefs) {
            prefs = await prisma.userPreferences.create({
                data: { userId: authUser.id, mode: 'BASIC', hideEmptyMarketOverview: false, hideEmptyCustomUniverses: false, hideEmptyPortfolio: false }
            });
        }
        const untypedPrefs = prefs as any;
        let parsedUniverses = ['SP500', 'NASDAQ100', 'CRYPTO'];
        try {
            if (untypedPrefs.screenerUniverses) {
                parsedUniverses = JSON.parse(untypedPrefs.screenerUniverses);
            }
        } catch (e) { }

        return {
            mode: prefs.mode,
            timezone: user?.timezone || 'America/Toronto', // Canonical: User.timezone
            hideEmptyMarketOverview: prefs.hideEmptyMarketOverview,
            hideEmptyCustomUniverses: prefs.hideEmptyCustomUniverses,
            hideEmptyPortfolio: prefs.hideEmptyPortfolio,
            screenerUniverses: parsedUniverses
        };
    });

    server.post('/api/settings/preferences', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.object({
            mode: z.enum(['BASIC', 'ADVANCED']).optional(),
            timezone: z.string().max(100).optional(),
            hideEmptyMarketOverview: z.boolean().optional(),
            hideEmptyCustomUniverses: z.boolean().optional(),
            hideEmptyPortfolio: z.boolean().optional(),
            screenerUniverses: z.array(z.string()).optional()
        });
        const updates = schema.parse(req.body);
        const authUser = req.user as { id: string };

        // Timezone is canonical on User, not UserPreferences
        if (updates.timezone) {
            try {
                Intl.DateTimeFormat(undefined, { timeZone: updates.timezone });
            } catch (e) {
                return reply.status(400).send({ error: 'Invalid IANA Timezone identifier.' });
            }
            // Write to canonical User.timezone
            await prisma.user.update({
                where: { id: authUser.id },
                data: { timezone: updates.timezone }
            });
        }

        // Build payload without timezone (it lives on User now)
        const { timezone: _tz, ...prefsUpdates } = updates;
        const payload: any = { ...prefsUpdates };
        if (updates.screenerUniverses) {
            payload.screenerUniverses = JSON.stringify(updates.screenerUniverses);
        }

        const prefs = await prisma.userPreferences.upsert({
            where: { userId: authUser.id },
            update: payload,
            create: { userId: authUser.id, mode: 'BASIC', ...payload }
        });

        const user = await prisma.user.findUnique({ where: { id: authUser.id }, select: { timezone: true } });

        const untypedPrefs = prefs as any;
        let parsedUniverses = ['SP500', 'NASDAQ100', 'CRYPTO'];
        try {
            if (untypedPrefs.screenerUniverses) {
                parsedUniverses = JSON.parse(untypedPrefs.screenerUniverses);
            }
        } catch (e) { }

        return {
            mode: prefs.mode,
            timezone: user?.timezone || 'America/Toronto', // Canonical: User.timezone
            hideEmptyMarketOverview: prefs.hideEmptyMarketOverview,
            hideEmptyCustomUniverses: prefs.hideEmptyCustomUniverses,
            hideEmptyPortfolio: prefs.hideEmptyPortfolio,
            screenerUniverses: parsedUniverses
        };
    });

    server.post('/api/settings/analysis', { preValidation: [server.authenticate] }, async (req, reply) => {
        const authUser = req.user as { id: string };
        const schema = z.object({
            name: z.string().max(100),
            assetTypeScope: z.string().default('BOTH'),
            configJson: z.string().max(10000),
            isActive: z.boolean().default(true)
        });
        const data = schema.parse(req.body);

        if (data.isActive) {
            await prisma.analysisConfig.updateMany({
                where: { userId: authUser.id, assetTypeScope: data.assetTypeScope },
                data: { isActive: false }
            });
        }

        return await prisma.analysisConfig.create({
            data: { ...data, userId: authUser.id }
        });
    });

    server.delete('/api/settings/analysis/:id', { preValidation: [server.authenticate] }, async (req, reply) => {
        const { id } = req.params as { id: string };
        const authUser = req.user as { id: string };

        const config = await prisma.analysisConfig.findUnique({ where: { id } });
        if (!config || config.userId !== authUser.id) {
            return reply.status(404).send({ error: 'Config not found' });
        }

        await prisma.analysisConfig.delete({ where: { id } });
        return { success: true };
    });

    // --- Prompt Template API ---
    server.get('/api/settings/prompts', { preValidation: [server.authenticate] }, async (req, reply) => {
        const authUser = req.user as { id: string };
        return await prisma.promptTemplate.findMany({
            where: { userId: authUser.id }
        });
    });

    server.post('/api/settings/prompts', { preValidation: [server.authenticate] }, async (req, reply) => {
        const authUser = req.user as { id: string };
        const schema = z.object({
            role: z.enum(['TECHNICAL', 'FUNDAMENTAL', 'SENTIMENT', 'BULL', 'BEAR', 'RISK', 'CONSENSUS', 'NARRATIVE']),
            templateText: z.string().max(8000, "Template text cannot exceed 8000 characters"),
            outputMode: z.enum(['TEXT_ONLY', 'JSON_STRICT', 'MARKDOWN', 'ACTION_LABELS']).default('TEXT_ONLY'),
            enabled: z.boolean().default(true)
        });
        const data = schema.parse(req.body);

        return await prisma.promptTemplate.upsert({
            where: { userId_scope_role: { userId: authUser.id, scope: 'GLOBAL', role: data.role } },
            update: data,
            create: { ...data, userId: authUser.id, scope: 'GLOBAL' }
        });
    });

    // --- Deterministic Outputs & Asset Summary API ---
    server.get('/api/asset/summary', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.object({
            symbol: z.string().toUpperCase(),
            assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK'),
            date: z.string().optional(), // YYYY-MM-DD
            range: z.string().optional().default('6m')
        });
        const { symbol, assetType, date, range } = schema.parse(req.query);

        const dh = date || toDateString();

        // 1. Get raw quote & candles
        const quote = await MarketData.getQuote(symbol, assetType);
        const candles = await MarketData.getCandles(symbol, assetType, range);

        // 2. Fetch specific Indicator & Prediction snapshots
        // Try exact date match first, fallback to latest
        const todayDate = dh.split('T')[0];
        let ind = await prisma.indicatorSnapshot.findFirst({
            where: { symbol, date: todayDate }
        });
        if (!ind) {
            ind = await prisma.indicatorSnapshot.findFirst({
                where: { symbol },
                orderBy: { date: 'desc' }
            });
        }

        // 3. Fetch Firm View deterministic roles (AnalysisSnapshot)
        const firmView = await prisma.analysisSnapshot.findMany({
            where: { symbol, assetType, ...(ind ? { date: ind.date } : {}) }
        });

        // 4. Transform firmView into a lookup dictionary by role
        const roles: Record<string, string> = {};
        firmView.forEach((f: any) => {
            roles[f.role] = f.payloadJson;
        });

        return {
            quote,
            candles,
            indicators: ind ? JSON.parse(ind.indicatorsJson) : null,
            evidencePack: ind ? PredictionService.generateEvidencePack(JSON.parse(ind.indicatorsJson)) : null,
            firmView: roles
        };
    });



    server.get('/api/overview/today', { preValidation: [server.authenticate] }, async (req, reply) => {
        const authUser = req.user as { id: string };

        const selections = await prisma.trackedAsset.findMany({
            where: { userId: authUser.id },
            orderBy: { order: 'asc' },
            include: { user: false } // Only simple details
        });

        // Fetch asset metadata for assetType mapping manually if include asset is tricky
        const assets = await prisma.asset.findMany({
            where: { symbol: { in: selections.map(s => s.symbol) } }
        });
        const assetMap = new Map(assets.map(a => [a.symbol, a.type]));

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
            return { symbol: sym, assetType: assetMap.get(sym) || 'STOCK', prediction: pred, indicators: ind };
        }));

        return results;
    });


    // --- Screener API ---
    server.get('/api/screener/:universe', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.object({ universe: z.enum(['SP500', 'NASDAQ100', 'CRYPTO', 'TSX60', 'IBOV']) });
        const { universe } = schema.parse(req.params);
        const assetType = universe === 'CRYPTO' ? 'CRYPTO' : 'STOCK';

        // Get Job state - use compound unique key
        const jobState = await prisma.jobState.findUnique({
            where: { universeType_universeName: { universeType: assetType, universeName: universe } }
        });

        // Get all snapshots ordered by date desc (latest first), then score desc
        const all = await prisma.screenerSnapshot.findMany({
            where: { universeName: universe },
            orderBy: [{ date: 'desc' }, { score: 'desc' }]
        });

        // Deduplicate: keep the first (i.e. latest + highest score) per symbol
        const seen = new Set<string>();
        const snapshots = all.filter(s => {
            if (seen.has(s.symbol)) return false;
            seen.add(s.symbol);
            return true;
        }).sort((a, b) => b.score - a.score).slice(0, 25);

        return { state: jobState, topCandidates: snapshots };
    });

    server.get('/api/screener/top/all', { preValidation: [server.authenticate] }, async (req, reply) => {
        const schema = z.object({ universes: z.string().optional() });
        const { universes } = schema.parse(req.query);

        const authUser = req.user as { id: string };

        let queryUniverses: string[] = [];
        if (universes) {
            queryUniverses = universes.split(',').slice(0, 10); // basic sanity cap
        } else {
            const prefs = await prisma.userPreferences.findUnique({ where: { userId: authUser.id } });
            if (prefs) {
                const untypedPrefs = prefs as any;
                if (untypedPrefs.screenerUniverses) {
                    try { queryUniverses = JSON.parse(untypedPrefs.screenerUniverses); } catch { }
                }
            }
            if (!queryUniverses || queryUniverses.length === 0) {
                queryUniverses = ['SP500', 'NASDAQ100', 'CRYPTO'];
            }
        }

        const all = await prisma.screenerSnapshot.findMany({
            where: { universeName: { in: queryUniverses } },
            orderBy: [{ date: 'desc' }, { score: 'desc' }]
        });

        // Deduplicate top 50 global
        const seen = new Set<string>();
        const snapshots = all.filter(s => {
            if (seen.has(s.symbol)) return false;
            seen.add(s.symbol);
            return true;
        }).sort((a, b) => b.score - a.score).slice(0, 50);

        return { topCandidates: snapshots, filtersUsed: queryUniverses };
    });

    // --- AI Generation Orchestration ---
    server.post('/api/ai/generate', {
        preValidation: [server.authenticate],
        config: { rateLimit: { max: 20, timeWindow: '1 hour' } }
    }, async (req, reply) => {
        const schema = z.object({
            date: z.string(),
            symbols: z.array(z.string()),
            llmConfigIds: z.array(z.string()),
            force: z.boolean().optional()
        });
        const { date, symbols, llmConfigIds, force } = schema.parse(req.body);

        const authUser = req.user as { id: string };

        // Verify ownership of all provided LLM configs
        const ownedConfigs = await prisma.userLLMConfig.findMany({
            where: { id: { in: llmConfigIds }, userId: authUser.id }
        });
        if (ownedConfigs.length !== llmConfigIds.length) {
            return reply.status(403).send({ error: 'One or more LLM Configurations are unauthorized or not found.' });
        }

        const results: any[] = [];
        const errors: string[] = [];

        // For each selected model, generate narratives side-by-side
        for (const config of ownedConfigs) {
            const configId = config.id;
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

                // --- Fetch deterministic context: try today first, fallback to latest ---
                const predContext = await prisma.predictionSnapshot.findFirst({
                    where: { symbol, horizonDays: 20 },
                    orderBy: { date: 'desc' }
                });

                const indContext = await prisma.indicatorSnapshot.findFirst({
                    where: { symbol },
                    orderBy: { date: 'desc' }
                });

                const firmView = await prisma.analysisSnapshot.findMany({
                    where: { symbol },
                    orderBy: { date: 'desc' },
                    take: 10
                });

                if (!predContext && firmView.length === 0 && !indContext) {
                    errors.push(`No indicator data found for ${symbol}. Run the Daily Job first.`);
                    continue;
                }

                let evidencePack = 'No raw indicators available.';
                if (indContext) {
                    evidencePack = PredictionService.generateEvidencePack(JSON.parse(indContext.indicatorsJson));
                }

                const assembledContext = {
                    baselinePrediction: predContext?.explanationText || 'No ML baseline',
                    evidencePack,
                    firmViewRoles: firmView.map(f => ({ role: f.role, summary: JSON.parse(f.payloadJson) }))
                };

                try {
                    let language = (req.headers['accept-language'] as string)?.split(',')[0] || 'en';
                    if (!['en', 'pt-BR', 'es', 'fr', 'de'].includes(language)) language = 'en';
                    const narrativeText = await LLMService.generateNarrative(config.id, authUser.id, symbol, date, JSON.stringify(assembledContext, null, 2), 'CONSENSUS', language);

                    const narrative = await prisma.aiNarrative.create({
                        data: {
                            userId: authUser.id,
                            symbol,
                            date,
                            llmConfigId: configId,
                            contentText: narrativeText,
                            providerUsed: config!.provider,
                            modelUsed: config!.model
                        }
                    });

                    results.push(narrative);
                } catch (llmErr: any) {
                    const msg = llmErr?.message || 'Unknown LLM error';
                    errors.push(`Provider error for ${symbol}: ${msg}`);
                    console.error(`[AI] LLM error for ${symbol} config ${configId}:`, msg);
                }
            }
        }

        if (results.length === 0 && errors.length > 0) {
            return reply.status(422).send({ error: errors.join('\n') });
        }

        return { results, errors };
    });

    // --- On-demand Realtime Analysis (uses price history cache) ---
    server.get('/api/asset/realtime-analysis', {
        preValidation: [server.authenticate],
        config: { rateLimit: { max: 60, timeWindow: '1 hour' } }
    }, async (req, reply) => {
        const schema = z.object({
            symbol: z.string().toUpperCase(),
            assetType: z.enum(['STOCK', 'CRYPTO']).default('STOCK')
        });
        const { symbol, assetType } = schema.parse(req.query);

        // Try cache first, fallback to live API
        const candles = await PriceHistoryService.getCandles(symbol, assetType, 180);
        if (!candles || (candles as any).c?.length === 0) {
            return reply.status(404).send({ error: 'No price data found. Run backfill first.' });
        }

        const indicators = IndicatorService.computeAll(candles as any);
        const firmViews = FirmViewService.generateFirmViews(indicators);
        const evidencePack = PredictionService.generateEvidencePack(indicators);
        const predictions = [
            { horizonDays: 1, ...PredictionService.predict(indicators, 1) },
            { horizonDays: 5, ...PredictionService.predict(indicators, 5) },
            { horizonDays: 20, ...PredictionService.predict(indicators, 20) }
        ];

        return { indicators, firmViews, evidencePack, predictions };
    });

    // --- Admin: Backfill Price History ---
    server.post('/api/admin/price-history/backfill', { preValidation: [server.requireAdmin], config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (req, reply) => {
        const schema = z.object({
            universe: z.enum(['SP500', 'NASDAQ100', 'CRYPTO', 'TSX60', 'IBOV']).optional(),
            symbols: z.array(z.string()).optional()
        });
        const { universe, symbols } = schema.parse(req.body);

        let targetSymbols: string[] = symbols || [];
        if (universe && targetSymbols.length === 0) {
            // Load from universe JSON file
            const fs = await import('fs');
            const path = await import('path');
            const filePath = path.join(__dirname, 'data', `${universe.toLowerCase()}.json`);
            targetSymbols = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }

        if (targetSymbols.length === 0) {
            return reply.status(400).send({ error: 'Provide either universe or symbols[]' });
        }

        const assetType = universe === 'CRYPTO' ? 'CRYPTO' : 'STOCK';

        // Fire-and-forget so the request doesn't time out
        setImmediate(async () => {
            let done = 0;
            for (const sym of targetSymbols) {
                try {
                    await PriceHistoryService.backfillSymbol(sym, assetType);
                    done++;
                } catch (e: any) {
                    console.error(`[Backfill] Error for ${sym}: ${e.message}`);
                }
            }
            console.log(`[Backfill] Done. ${done}/${targetSymbols.length} symbols processed.`);
        });

        return { status: 'Backfill started', total: targetSymbols.length };
    });

    // --- Admin ---
    server.post('/api/admin/run-daily', { preValidation: [server.requireAdmin], config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (req, reply) => {
        const schema = z.object({ date: z.string().optional() });
        const { date } = schema.parse(req.query);

        setImmediate(() => {
            DailyJobService.runDailyJob(date).catch(console.error);
        });

        return { status: "Job queued" };
    });

    server.post('/api/admin/screener/run', { preValidation: [server.requireAdmin], config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req, reply) => {
        const schema = z.object({
            universe: z.enum(['SP500', 'NASDAQ100', 'CRYPTO', 'TSX60', 'IBOV']),
            date: z.string()
        });
        const { universe, date } = schema.parse(req.body);
        const assetType = universe === 'CRYPTO' ? 'CRYPTO' : 'STOCK';

        const jobState = await prisma.jobState.findUnique({
            where: { universeType_universeName: { universeType: assetType, universeName: universe } }
        });
        if (jobState && jobState.status === 'RUNNING') {
            return reply.status(409).send({ error: 'Screener job is already running for this universe.' });
        }

        setImmediate(() => {
            ScreenerService.runScreenerJob(universe, date).catch(console.error);
        });

        return { status: "Screener job queued", universe };
    });
}
