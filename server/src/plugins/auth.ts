import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/cache';

export default fp(async (fastify) => {
    // Register cookie plugin
    fastify.register(cookie, {
        secret: process.env.COOKIE_SECRET || 'supersecretcookie_default_dev_only', // Use a real secret in production
        hook: 'onRequest'
    });

    // Register JWT plugin
    fastify.register(jwt, {
        secret: process.env.JWT_SECRET || 'supersecretjwt_default_dev_only',
        cookie: {
            cookieName: 'token',
            signed: false
        }
    });

    // Decorate fastify with an authentication middleware
    fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
        try {
            await request.jwtVerify();
            const tokenUser = request.user as { id: string };
            const u = await prisma.user.findUnique({ where: { id: tokenUser.id } });

            if (!u) {
                return reply.status(401).send({ error: 'Unauthorized: User not found' });
            }
            if (u.status === 'BANNED') {
                return reply.status(403).send({ error: 'Forbidden: Account is banned' });
            }
            if (u.mustChangePassword && !request.url.startsWith('/api/auth/update-password') && !request.url.startsWith('/api/auth/logout') && !request.url.startsWith('/api/user/change-password')) {
                return reply.status(403).send({ error: 'Forbidden: Password change required', mustChangePassword: true });
            }

            request.user = { id: u.id, role: u.role };
        } catch (err) {
            return reply.status(401).send({ error: 'Unauthorized: Invalid or missing token' });
        }
    });

    // Decorate fastify with an admin middleware
    fastify.decorate('requireAdmin', async function (request: FastifyRequest, reply: FastifyReply) {
        try {
            await request.jwtVerify();
            const tokenUser = request.user as { id: string };
            const u = await prisma.user.findUnique({ where: { id: tokenUser.id } });

            if (!u) {
                return reply.status(401).send({ error: 'Unauthorized: User not found' });
            }
            if (u.status === 'BANNED') {
                return reply.status(403).send({ error: 'Forbidden: Account is banned' });
            }
            if (u.mustChangePassword && !request.url.startsWith('/api/auth/update-password') && !request.url.startsWith('/api/auth/logout') && !request.url.startsWith('/api/user/change-password')) {
                return reply.status(403).send({ error: 'Forbidden: Password change required', mustChangePassword: true });
            }
            if (!['ADMIN', 'SUPERADMIN'].includes(u.role)) {
                return reply.status(403).send({ error: 'Forbidden: Admin access only' });
            }

            request.user = { id: u.id, role: u.role };
        } catch (err) {
            return reply.status(401).send({ error: 'Unauthorized: Invalid or missing token' });
        }
    });

    // Decorate fastify with a superadmin middleware
    fastify.decorate('requireSuperAdmin', async function (request: FastifyRequest, reply: FastifyReply) {
        try {
            await request.jwtVerify();
            const tokenUser = request.user as { id: string };
            const u = await prisma.user.findUnique({ where: { id: tokenUser.id } });

            if (!u) {
                return reply.status(401).send({ error: 'Unauthorized: User not found' });
            }
            if (u.status === 'BANNED') {
                return reply.status(403).send({ error: 'Forbidden: Account is banned' });
            }
            if (u.mustChangePassword && !request.url.startsWith('/api/auth/update-password') && !request.url.startsWith('/api/auth/logout') && !request.url.startsWith('/api/user/change-password')) {
                return reply.status(403).send({ error: 'Forbidden: Password change required', mustChangePassword: true });
            }
            if (u.role !== 'SUPERADMIN') {
                return reply.status(403).send({ error: 'Forbidden: Superadmin access only' });
            }

            request.user = { id: u.id, role: u.role };
        } catch (err) {
            return reply.status(401).send({ error: 'Unauthorized: Invalid or missing token' });
        }
    });
});

// Add type declarations for Fastify
declare module 'fastify' {
    export interface FastifyInstance {
        authenticate: any;
        requireAdmin: any;
        requireSuperAdmin: any;
    }
}
