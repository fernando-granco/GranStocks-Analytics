import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/cache';
import bcrypt from 'bcryptjs';

export default async function userRoutes(fastify: FastifyInstance) {

    fastify.get('/profile', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const payload = request.user as { id: string };
        const user = await prisma.user.findUnique({
            where: { id: payload.id },
            select: { email: true, fullName: true, timezone: true, role: true, status: true, lastLoginAt: true }
        });

        if (!user) return reply.status(404).send({ error: 'User not found' });
        return reply.send(user);
    });

    fastify.patch('/profile', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const payload = request.user as { id: string };

        const schema = z.object({
            fullName: z.string().max(100).optional().nullable(),
            timezone: z.string().optional(),
            email: z.string().email().optional(),
            currentPassword: z.string().optional()
        });

        try {
            const { fullName, timezone, email, currentPassword } = schema.parse(request.body);
            const user = await prisma.user.findUnique({ where: { id: payload.id } });
            if (!user) return reply.status(404).send({ error: 'User not found' });

            const updates: any = {};
            if (fullName !== undefined) updates.fullName = fullName;
            if (timezone !== undefined) updates.timezone = timezone;

            if (email && email !== user.email) {
                if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
                    return reply.status(401).send({ error: 'Current password is required and must be valid to change email.' });
                }
                const existing = await prisma.user.findUnique({ where: { email } });
                if (existing) return reply.status(409).send({ error: 'Email already in use.' });

                updates.email = email;
                if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true') {
                    updates.emailVerifiedAt = null;
                }
            }

            const updatedUser = await prisma.user.update({
                where: { id: user.id },
                data: updates,
                select: { email: true, fullName: true, timezone: true, role: true, status: true }
            });

            return reply.send(updatedUser);
        } catch (error: any) {
            if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation Error', details: error.errors });
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    fastify.post('/change-password', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const payload = request.user as { id: string };
        const schema = z.object({
            currentPassword: z.string(),
            newPassword: z.string().min(6)
        });

        try {
            const { currentPassword, newPassword } = schema.parse(request.body);
            const user = await prisma.user.findUnique({ where: { id: payload.id } });
            if (!user) return reply.status(404).send({ error: 'User not found' });

            if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
                return reply.status(401).send({ error: 'Invalid current password.' });
            }

            const passwordHash = await bcrypt.hash(newPassword, 10);
            await prisma.user.update({
                where: { id: user.id },
                data: { passwordHash, mustChangePassword: false }
            });

            return reply.send({ success: true });
        } catch (error: any) {
            if (error instanceof z.ZodError) return reply.status(400).send({ error: 'Validation Error', details: error.errors });
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
}
