import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifyRateLimit from '@fastify/rate-limit';
import path from 'path';
import { prisma } from './services/cache';
import { registerRoutes } from './routes';
import authRoutes from './routes/auth';
import authPlugin from './plugins/auth';
import { BinanceProvider } from './services/providers/binance';
import { DailyJobService } from './services/scheduler';
import { bootstrapSuperAdmin } from './services/admin';
import demoRoutes from './routes/demo';
import adminRoutes from './routes/admin';
import universeRoutes from './routes/universes';
import portfolioRoutes from './routes/portfolio';
import { DemoService } from './services/demo';
import userRoutes from './routes/user';

const server = fastify({ logger: true });

async function start() {
    await server.register(cors, {
        origin: process.env.APP_ORIGIN || 'http://localhost:5173'
    });

    await server.register(fastifyRateLimit, {
        global: false, // We only apply it to specific routes like /auth/* if configured
        max: 100,
        timeWindow: '1 minute'
    });

    // Health Check
    server.get('/api/health', async () => {
        return { status: 'OK' };
    });
    // Register Plugins
    await server.register(authPlugin);

    // Register API endpoints First
    server.register(demoRoutes, { prefix: '/api/demo' }); // Public
    server.register(authRoutes, { prefix: '/api/auth' }); // Public
    server.register(adminRoutes, { prefix: '/api/admin' }); // Auto-checks preValidation RequireAdmin inside
    server.register(universeRoutes, { prefix: '/api' });
    server.register(portfolioRoutes, { prefix: '/api/portfolio' }); // Registers /api/symbols and /api/universes
    server.register(userRoutes, { prefix: '/api/user' });
    await registerRoutes(server); // Protected by preValidation locally

    // Client static serving (VPS specific deployment constraint)
    server.register(fastifyStatic, {
        root: path.join(__dirname, '../../client/dist'),
        prefix: '/',
    });

    // Client fallback routing for SPA
    server.setNotFoundHandler((req, reply) => {
        if (req.raw.url && req.raw.url.startsWith('/api')) {
            reply.status(404).send({ error: 'API route not found' });
            return;
        }
        reply.sendFile('index.html');
    });

    try {
        if (process.env.NODE_ENV === 'production') {
            const jwt = process.env.JWT_SECRET;
            const enc = process.env.ENCRYPTION_MASTER_KEY;
            const origin = process.env.APP_ORIGIN;
            const cookie = process.env.COOKIE_SECRET;

            if (!origin || origin.includes('localhost')) {
                console.warn("WARNING: APP_ORIGIN looks like localhost in production.");
            }

            if (!jwt || jwt === 'supersecretjwt_default_dev_only' || jwt.length < 16) {
                console.error("FATAL: Insecure JWT_SECRET in production.");
                process.exit(1);
            }

            if (!cookie || cookie === 'supersecretcookie_default_dev_only' || cookie.length < 16) {
                console.error("FATAL: Insecure COOKIE_SECRET in production.");
                process.exit(1);
            }

            if (!enc || enc.length !== 32) {
                console.error("FATAL: ENCRYPTION_MASTER_KEY must be exactly 32 chars in production.");
                process.exit(1);
            }
        }

        // High-Concurrency SQLite PRAGMAS
        await prisma.$queryRaw`PRAGMA journal_mode = WAL;`;
        await prisma.$queryRaw`PRAGMA busy_timeout = 5000;`;

        await bootstrapSuperAdmin(); // Guarantee superadmin exists

        // Ensure Demo Snapshots exist
        prisma.demoSnapshotMeta.count().then((count: number) => {
            if (count === 0) {
                DemoService.rebuildDemoSnapshots().catch(console.error);
            }
        });

        DailyJobService.startCron(); // Start background cron scheduler
        BinanceProvider.initWebSocket(); // Start Crypto feed

        const port = parseInt(process.env.PORT || '3000', 10);
        await server.listen({ port, host: '0.0.0.0' });
        console.log(`Server listening on port ${port}`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
}

start();
