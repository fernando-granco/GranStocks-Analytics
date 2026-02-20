import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { registerRoutes } from './routes';
import { DailyJobService } from './services/scheduler';

const server = fastify({ logger: true });

async function start() {
    await server.register(cors, {
        origin: process.env.APP_ORIGIN || 'http://localhost:5173'
    });

    // Health Check
    server.get('/api/health', async () => {
        return { status: 'OK' };
    });

    // Register API endpoints First
    await registerRoutes(server);

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
        DailyJobService.startCron(); // Start background cron scheduler

        await server.listen({ port: 3000, host: '0.0.0.0' });
        console.log('Server listening on port 3000');
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
}

start();
