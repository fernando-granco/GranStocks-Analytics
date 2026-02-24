import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/cache';
import z from 'zod';
import bcrypt from 'bcryptjs';

export default async function adminRoutes(server: FastifyInstance) {

    // Auto-apply admin requirement to all routes in this plugin
    server.addHook('preValidation', server.requireAdmin);

    server.get('/users', async (req: FastifyRequest, reply: FastifyReply) => {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                role: true,
                status: true,
                mustChangePassword: true,
                createdAt: true,
                lastLoginAt: true,
                emailVerifiedAt: true
            },
            orderBy: { createdAt: 'desc' }
        });
        return users;
    });

    server.patch('/users/:id', async (req: FastifyRequest, reply: FastifyReply) => {
        const schema = z.object({
            role: z.enum(['USER', 'ADMIN']).optional(),
            status: z.enum(['ACTIVE', 'BANNED']).optional(),
            mustChangePassword: z.boolean().optional()
        });
        const { id } = req.params as { id: string };
        const updates = schema.parse(req.body);

        const authUser = req.user as { id: string };

        // Prevent self-demotion or self-ban
        if (id === authUser.id && (updates.role === 'USER' || updates.status === 'BANNED')) {
            return reply.status(403).send({ error: "Cannot demote or ban yourself." });
        }

        const user = await prisma.user.update({
            where: { id },
            data: updates,
            select: { id: true, email: true, role: true, status: true, mustChangePassword: true }
        });

        await prisma.adminAuditLog.create({
            data: {
                actorUserId: authUser.id,
                targetUserId: id,
                action: 'UPDATE_USER',
                metadataJson: JSON.stringify(updates)
            }
        });

        return user;
    });

    server.post('/users/:id/set-password', async (req: FastifyRequest, reply: FastifyReply) => {
        // Developer-only convenience path. Must be disabled entirely in true production
        if (process.env.NODE_ENV === 'production') {
            return reply.status(403).send({ error: "Direct password setting disabled in production. Use Force Reset." });
        }

        const schema = z.object({ newPassword: z.string().min(6) });
        const { id } = req.params as { id: string };
        const { newPassword } = schema.parse(req.body);
        const authUser = req.user as { id: string };

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id },
            data: { passwordHash, mustChangePassword: true } // force them to change it on next login
        });

        await prisma.adminAuditLog.create({
            data: {
                actorUserId: authUser.id,
                targetUserId: id,
                action: 'SET_PASSWORD_DEV',
                metadataJson: JSON.stringify({ note: "Dev mode forced password block" })
            }
        });

        return { success: true, message: "Password updated successfully." };
    });

    server.post('/users/:id/force-reset', async (req: FastifyRequest, reply: FastifyReply) => {
        const { id } = req.params as { id: string };
        const authUser = req.user as { id: string };

        // In DEV: just flip the flag
        // In PROD: ideally generate a token and shoot an email. For now, flip the flag.
        await prisma.user.update({
            where: { id },
            data: { mustChangePassword: true }
        });

        await prisma.adminAuditLog.create({
            data: {
                actorUserId: authUser.id,
                targetUserId: id,
                action: 'FORCE_PASSWORD_RESET',
                metadataJson: '{}'
            }
        });

        return { success: true, message: "User forced to reset password on next login." };
    });

    server.delete('/users/:id', async (req: FastifyRequest, reply: FastifyReply) => {
        const { id } = req.params as { id: string };
        const authUser = req.user as { id: string };

        if (id === authUser.id) {
            return reply.status(403).send({ error: "Cannot delete yourself." });
        }

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return reply.status(404).send({ error: "User not found" });

        await prisma.user.delete({ where: { id } });

        await prisma.adminAuditLog.create({
            data: {
                actorUserId: authUser.id,
                targetUserId: id,
                action: 'DELETE_USER',
                metadataJson: JSON.stringify({ email: user.email })
            }
        });

        return { success: true, message: "User deleted successfully." };
    });

    server.get('/audit', async (req: FastifyRequest, reply: FastifyReply) => {
        const logs = await prisma.adminAuditLog.findMany({
            include: {
                actorUser: { select: { email: true } },
                targetUser: { select: { email: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        return logs;
    });
    // --- Invite Codes ---
    server.get('/invites', async (req: FastifyRequest, reply: FastifyReply) => {
        const codes = await prisma.inviteCode.findMany({
            include: {
                _count: {
                    select: { uses: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return codes;
    });

    server.post('/invites', async (req: FastifyRequest, reply: FastifyReply) => {
        const schema = z.object({
            code: z.string().optional(),
            maxUses: z.number().min(1).default(1),
            expiresDays: z.number().nullable().optional()
        });
        const { code, maxUses, expiresDays } = schema.parse(req.body);
        const authUser = req.user as { id: string };

        const finalCode = code || require('crypto').randomBytes(4).toString('hex').toUpperCase();
        let expiresAt = null;
        if (expiresDays) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiresDays);
        }

        const invite = await prisma.inviteCode.create({
            data: {
                code: finalCode,
                maxUses,
                expiresAt,
                createdBy: authUser.id
            }
        });

        await prisma.adminAuditLog.create({
            data: {
                actorUserId: authUser.id,
                targetUserId: authUser.id,
                action: 'CREATE_INVITE',
                metadataJson: JSON.stringify({ code: finalCode, maxUses })
            }
        });

        return invite;
    });

    server.delete('/invites/:id', async (req: FastifyRequest, reply: FastifyReply) => {
        const { id } = req.params as { id: string };
        const authUser = req.user as { id: string };

        const existing = await prisma.inviteCode.findUnique({ where: { id } });
        if (!existing) return reply.status(404).send({ error: "Invite code not found" });

        await prisma.inviteCode.delete({ where: { id } });

        await prisma.adminAuditLog.create({
            data: {
                actorUserId: authUser.id,
                targetUserId: authUser.id,
                action: 'DELETE_INVITE',
                metadataJson: JSON.stringify({ code: existing.code })
            }
        });

        return { success: true };
    });
}
