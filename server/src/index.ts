import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
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
import { DemoService } from './services/demo';

const server = fastify({ logger: true });

async function start() {
    await server.register(cors, {
        origin: process.env.APP_ORIGIN || 'http://localhost:5173'
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
    server.register(universeRoutes, { prefix: '/api' }); // Registers /api/symbols and /api/universes
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
        // High-Concurrency SQLite PRAGMAS
        await prisma.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`);
        await prisma.$queryRawUnsafe(`PRAGMA busy_timeout = 5000;`);

        await bootstrapSuperAdmin(); // Guarantee superadmin exists

        // Ensure Demo Snapshots exist
        prisma.demoSnapshotMeta.count().then((count: number) => {
            if (count === 0) {
                DemoService.rebuildDemoSnapshots().catch(console.error);
            }
        });

        DailyJobService.startCron(); // Start background cron scheduler
        BinanceProvider.initWebSocket(); // Start Crypto feed

        await server.listen({ port: 3000, host: '0.0.0.0' });
        console.log('Server listening on port 3000');
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
}

start();
