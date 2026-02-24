import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/cache';
import bcrypt from 'bcryptjs';

const authSchema = z.object({
    email: z.string().email(),
    password: z.string().min(10),
    inviteCode: z.string().optional()
});

export default async function authRoutes(fastify: FastifyInstance) {
    fastify.post('/register', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { email, password, inviteCode } = authSchema.parse(request.body);

            if (process.env.REQUIRE_INVITE_CODE === 'true') {
                if (!inviteCode) {
                    return reply.status(403).send({ error: 'Invite code is required for registration' });
                }

                const validCode = await prisma.inviteCode.findUnique({ where: { code: inviteCode } });
                if (!validCode) {
                    return reply.status(403).send({ error: 'Invalid invite code' });
                }

                if (validCode.expiresAt && validCode.expiresAt < new Date()) {
                    return reply.status(403).send({ error: 'Invite code expired' });
                }

                const useCount = await prisma.inviteCodeUse.count({ where: { inviteCodeId: validCode.id } });
                if (useCount >= validCode.maxUses) {
                    return reply.status(403).send({ error: 'Invite code usage limit reached' });
                }
            }

            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return reply.status(409).send({ error: 'User already exists' });
            }

            const passwordHash = await bcrypt.hash(password, 10);
            const user = await prisma.user.create({
                data: { email, passwordHash, role: 'USER' }
            });

            if (process.env.REQUIRE_INVITE_CODE === 'true' && inviteCode) {
                const validCode = await prisma.inviteCode.findUnique({ where: { code: inviteCode } });
                if (validCode) {
                    await prisma.inviteCodeUse.create({
                        data: {
                            inviteCodeId: validCode.id,
                            userId: user.id
                        }
                    });
                }
            }

            const token = fastify.jwt.sign({ id: user.id });
            reply.setCookie('token', token, {
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 // 7 days
            });

            return reply.send({ id: user.id, email: user.email, role: user.role });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Validation Error', details: error.errors });
            }
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    fastify.post('/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { email, password } = authSchema.parse(request.body);

            const user = await prisma.user.findUnique({ where: { email } });
            if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
                return reply.status(401).send({ error: 'Invalid email or password' });
            }

            if (user.status === 'BANNED') {
                return reply.status(403).send({ error: 'Account suspended. Contact support.' });
            }

            if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !user.emailVerifiedAt) {
                return reply.status(403).send({ error: 'Please verify your email address to continue.' });
            }

            // Track login
            await prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() }
            });

            const token = fastify.jwt.sign({ id: user.id });
            reply.setCookie('token', token, {
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60
            });

            return reply.send({ id: user.id, email: user.email, role: user.role });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Validation Error', details: error.errors });
            }
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
        reply.clearCookie('token', { path: '/' });
        return reply.send({ message: 'Logged out' });
    });

    fastify.get('/me', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const payload = request.user as { id: string };
        const user = await prisma.user.findUnique({ where: { id: payload.id } });
        if (!user) {
            return reply.status(404).send({ error: 'User not found' });
        }
        if (user.status === 'BANNED') {
            reply.clearCookie('token', { path: '/' });
            return reply.status(403).send({ error: 'Account suspended.' });
        }
        return reply.send({ id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status, mustChangePassword: user.mustChangePassword });
    });

    // --- Prod Skeleton Endpoints ---

    fastify.post('/request-password-reset', { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
        if (process.env.ENABLE_EMAIL_PASSWORD_RESET !== 'true') {
            return reply.status(501).send({ error: 'Password reset is disabled in this environment.' });
        }
        const schema = z.object({ email: z.string().email() });
        const { email } = schema.parse(request.body);

        // TODO: Generate PasswordResetToken, Send Email with Service
        console.log(`[Prod Skeleton] Password Reset requested.`);
        return reply.send({ message: 'If that email is registered, a reset link will be sent.' });
    });

    fastify.post('/reset-password', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
        if (process.env.ENABLE_EMAIL_PASSWORD_RESET !== 'true') {
            return reply.status(501).send({ error: 'Password reset is disabled.' });
        }
        // TODO: Verify token, Hash new password, clear mustChangePassword
        return reply.status(501).send({ error: 'Not implemented' });
    });

    fastify.post('/verify-email', async (request: FastifyRequest, reply: FastifyReply) => {
        // TODO: Verify email token, update user.emailVerifiedAt
        return reply.status(501).send({ error: 'Not implemented' });
    });
}
