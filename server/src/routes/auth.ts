import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/cache';
import bcrypt from 'bcryptjs';
import { EmailService } from '../services/email';
import crypto from 'crypto';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(10)
});

const registerSchema = loginSchema.extend({
    inviteCode: z.string().trim().toUpperCase()
});

export default async function authRoutes(fastify: FastifyInstance) {
    fastify.post('/register', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { email, password, inviteCode } = registerSchema.parse(request.body);

            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return reply.status(409).send({ error: 'User already exists' });
            }

            const passwordHash = await bcrypt.hash(password, 10);

            // Execute registration in a transaction to prevent race conditions on invite limits
            const user = await prisma.$transaction(async (tx) => {
                const validCode = await tx.inviteCode.findUnique({ where: { code: inviteCode } });

                if (!validCode) {
                    throw new Error('INV_FAIL');
                }

                if (validCode.expiresAt && validCode.expiresAt < new Date()) {
                    throw new Error('INV_FAIL');
                }

                // Enforce usage limits only if maxUses is strictly greater than 0
                if (validCode.maxUses > 0) {
                    const useCount = await tx.inviteCodeUse.count({ where: { inviteCodeId: validCode.id } });
                    if (useCount >= validCode.maxUses) {
                        throw new Error('INV_FAIL');
                    }
                }

                const newUser = await tx.user.create({
                    data: { email, passwordHash, role: 'USER' }
                });

                await tx.inviteCodeUse.create({
                    data: {
                        inviteCodeId: validCode.id,
                        userId: newUser.id
                    }
                });

                return newUser;
            });

            // Send verification email asynchronously (don't block registration response)
            if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' || EmailService.isEnabled()) {
                const verificationToken = fastify.jwt.sign({ id: user.id, purpose: 'email-verify' }, { expiresIn: '24h' });
                EmailService.sendVerificationEmail(user.email, verificationToken).catch(console.error);
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
            if (error.message === 'INV_FAIL') {
                // Log specific failure internally if needed, but return generic to client
                return reply.status(403).send({ error: 'Invalid, expired, or unavailable invite code.' });
            }
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    fastify.post('/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { email, password } = loginSchema.parse(request.body);

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

    fastify.post('/update-password', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const updateSchema = z.object({ newPassword: z.string().min(10) });
            const { newPassword } = updateSchema.parse(request.body);
            const payload = request.user as { id: string };

            const user = await prisma.user.findUnique({ where: { id: payload.id } });
            if (!user) return reply.status(404).send({ error: 'User not found' });

            if (!user.mustChangePassword) {
                return reply.status(403).send({ error: 'Forbidden: You must use the normal change password flow (/api/user/change-password) requiring current password.' });
            }

            const passwordHash = await bcrypt.hash(newPassword, 10);
            await prisma.user.update({
                where: { id: payload.id },
                data: {
                    passwordHash,
                    mustChangePassword: false
                }
            });

            return reply.send({ message: 'Password updated successfully' });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Password must be at least 10 characters long.', details: error.errors });
            }
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // -------------------------------------------------------------------------
    // Email Verification
    // -------------------------------------------------------------------------

    fastify.post('/verify-email', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
        const schema = z.object({ token: z.string() });
        try {
            const { token } = schema.parse(request.body);
            const payload = fastify.jwt.verify(token) as { id: string; purpose?: string };

            if (payload.purpose !== 'email-verify') {
                return reply.status(400).send({ error: 'Invalid token.' });
            }

            const user = await prisma.user.findUnique({ where: { id: payload.id } });
            if (!user) return reply.status(404).send({ error: 'User not found.' });
            if (user.emailVerifiedAt) return reply.send({ message: 'Email already verified.' });

            await prisma.user.update({
                where: { id: payload.id },
                data: { emailVerifiedAt: new Date() }
            });

            return reply.send({ message: 'Email verified successfully.' });
        } catch (error: any) {
            if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Invalid request.' });
            if (error.code === 'FAST_JWT_EXPIRED') return reply.status(400).send({ error: 'Verification link has expired. Please request a new one.' });
            return reply.status(400).send({ error: 'Invalid or expired verification token.' });
        }
    });

    fastify.post('/resend-verification', { preValidation: [fastify.authenticate], config: { rateLimit: { max: 3, timeWindow: '5 minutes' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
        const payload = request.user as { id: string };
        const user = await prisma.user.findUnique({ where: { id: payload.id } });
        if (!user) return reply.status(404).send({ error: 'User not found.' });
        if (user.emailVerifiedAt) return reply.status(400).send({ error: 'Email is already verified.' });

        const verificationToken = fastify.jwt.sign({ id: user.id, purpose: 'email-verify' }, { expiresIn: '24h' });
        await EmailService.sendVerificationEmail(user.email, verificationToken);
        return reply.send({ message: 'Verification email resent.' });
    });

    // -------------------------------------------------------------------------
    // Password Reset
    // -------------------------------------------------------------------------

    fastify.post('/request-password-reset', { config: { rateLimit: { max: 3, timeWindow: '5 minutes' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
        if (process.env.ENABLE_EMAIL_PASSWORD_RESET !== 'true' && !EmailService.isEnabled()) {
            return reply.status(501).send({ error: 'Password reset is disabled in this environment.' });
        }

        const schema = z.object({ email: z.string().email() });
        try {
            const { email } = schema.parse(request.body);
            const user = await prisma.user.findUnique({ where: { email } });

            // Always return the same message to avoid email enumeration
            const genericMsg = { message: 'If that email is registered, a reset link will be sent.' };
            if (!user) return reply.send(genericMsg);

            // Generate a short-lived, single-use token stored securely as a hash
            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

            // Invalidate old tokens for this user
            await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

            await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
                }
            });

            await EmailService.sendPasswordResetEmail(user.email, rawToken);
            return reply.send(genericMsg);
        } catch (error: any) {
            if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Please enter a valid email address.' });
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    fastify.post('/reset-password', { config: { rateLimit: { max: 5, timeWindow: '5 minutes' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
        if (process.env.ENABLE_EMAIL_PASSWORD_RESET !== 'true' && !EmailService.isEnabled()) {
            return reply.status(501).send({ error: 'Password reset is disabled.' });
        }

        const schema = z.object({
            token: z.string(),
            newPassword: z.string().min(10)
        });

        try {
            const { token, newPassword } = schema.parse(request.body);
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

            const resetRecord = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
            if (!resetRecord || resetRecord.expiresAt < new Date()) {
                return reply.status(400).send({ error: 'This reset link is invalid or has expired. Please request a new one.' });
            }

            const passwordHash = await bcrypt.hash(newPassword, 10);
            await prisma.user.update({
                where: { id: resetRecord.userId },
                data: { passwordHash, mustChangePassword: false }
            });

            // Delete consumed token
            await prisma.passwordResetToken.delete({ where: { tokenHash } });

            return reply.send({ message: 'Password reset successfully. You can now log in.' });
        } catch (error: any) {
            if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Password must be at least 10 characters.' });
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
}


