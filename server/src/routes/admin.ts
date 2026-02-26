import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/cache';
import { HistoryWarmQueue } from '../services/history-queue';
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
            role: z.enum(['USER', 'ADMIN', 'SUPERADMIN']).optional(),
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

        const targetUser = await prisma.user.findUnique({ where: { id } });
        if (!targetUser) return reply.status(404).send({ error: "User not found" });

        const actor = await prisma.user.findUnique({ where: { id: authUser.id } });
        if (!actor) return reply.status(401).send({ error: "Actor not found" });

        // Admin peer-protection: Only SUPERADMIN can modify another ADMIN or SUPERADMIN
        if ((targetUser.role === 'ADMIN' || targetUser.role === 'SUPERADMIN') && actor.role !== 'SUPERADMIN') {
            return reply.status(403).send({ error: "Permission denied: Admins cannot modify other Admins or Superadmins." });
        }

        // Privilege escalation protection: Only SUPERADMIN can grant SUPERADMIN role
        if (updates.role === 'SUPERADMIN' && actor.role !== 'SUPERADMIN') {
            return reply.status(403).send({ error: "Permission denied: Only Superadmins can assign the Superadmin role." });
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

        const { id } = req.params as { id: string };
        const authUser = req.user as { id: string };
        const actor = await prisma.user.findUnique({ where: { id: authUser.id } });
        const targetUser = await prisma.user.findUnique({ where: { id } });

        if (!actor || !targetUser) return reply.status(404).send({ error: "User not found" });

        // Admin peer-protection: Only SUPERADMIN can modify another ADMIN or SUPERADMIN
        if ((targetUser.role === 'ADMIN' || targetUser.role === 'SUPERADMIN') && actor.role !== 'SUPERADMIN') {
            return reply.status(403).send({ error: "Permission denied: Admins cannot modify other Admins or Superadmins." });
        }

        const schema = z.object({ newPassword: z.string().min(10) });
        const { newPassword } = schema.parse(req.body);

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

        const actor = await prisma.user.findUnique({ where: { id: authUser.id } });
        const targetUser = await prisma.user.findUnique({ where: { id } });

        if (!actor || !targetUser) return reply.status(404).send({ error: "User not found" });

        // Admin peer-protection: Only SUPERADMIN can modify another ADMIN or SUPERADMIN
        if ((targetUser.role === 'ADMIN' || targetUser.role === 'SUPERADMIN') && actor.role !== 'SUPERADMIN') {
            return reply.status(403).send({ error: "Permission denied: Admins cannot modify other Admins or Superadmins." });
        }

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
                metadataJson: JSON.stringify({ action: 'forced' })
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

        const [user, actor] = await Promise.all([
            prisma.user.findUnique({ where: { id } }),
            prisma.user.findUnique({ where: { id: authUser.id } })
        ]);

        if (!user) return reply.status(404).send({ error: "User not found" });
        if (!actor) return reply.status(401).send({ error: "Actor not found" });

        // Admin peer-protection: Only SUPERADMIN can delete another ADMIN or SUPERADMIN
        if ((user.role === 'ADMIN' || user.role === 'SUPERADMIN') && actor.role !== 'SUPERADMIN') {
            return reply.status(403).send({ error: "Permission denied: Admins cannot delete other Admins or Superadmins." });
        }

        // Clean up cascading relations to prevent foreign key constraint violations
        await prisma.$transaction([
            prisma.trackedAsset.deleteMany({ where: { userId: id } }),
            prisma.userLLMConfig.deleteMany({ where: { userId: id } }),
            prisma.aiNarrative.deleteMany({ where: { userId: id } }),
            prisma.userPreferences.deleteMany({ where: { userId: id } }),
            prisma.universe.deleteMany({ where: { userId: id } }),
            prisma.passwordResetToken.deleteMany({ where: { userId: id } }),
            prisma.analysisConfig.deleteMany({ where: { userId: id } }),
            prisma.promptTemplate.deleteMany({ where: { userId: id } }),
            prisma.alertRule.deleteMany({ where: { userId: id } }),
            prisma.portfolioPosition.deleteMany({ where: { userId: id } }),
            prisma.inviteCodeUse.deleteMany({ where: { userId: id } }),
            prisma.adminAuditLog.deleteMany({ where: { actorUserId: id } }),
            prisma.adminAuditLog.deleteMany({ where: { targetUserId: id } }),
            prisma.user.delete({ where: { id } })
        ]);

        await prisma.adminAuditLog.create({
            data: {
                actorUserId: authUser.id,
                targetUserId: authUser.id, // Cannot target deleted user, must target self
                action: 'DELETE_USER',
                metadataJson: JSON.stringify({ deletedUserId: id, email: user.email, role: user.role })
            }
        });

        return { success: true, message: "User securely deleted." };
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
            maxUses: z.number().min(0).default(1),
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

    // --- Jobs & Queue Status ---
    server.get('/jobs', async (req: FastifyRequest, reply: FastifyReply) => {
        const jobs = await prisma.jobState.findMany({
            orderBy: { updatedAt: 'desc' }
        });
        const queue = HistoryWarmQueue.getQueueStatus();
        return { jobs, queue };
    });

    // --- Cache Health Metrics ---
    server.get('/cache-health', async (req: FastifyRequest, reply: FastifyReply) => {
        const allStates = await prisma.symbolCacheState.findMany();
        const ready = allStates.filter(s => s.status === 'READY').length;
        const pending = allStates.filter(s => s.status === 'PENDING').length;
        const failed = allStates.filter(s => s.status === 'FAILED').length;

        const recentFailures = allStates
            .filter(s => s.status === 'FAILED' && s.lastError)
            .sort((a, b) => (b.lastAttemptAt?.getTime() || 0) - (a.lastAttemptAt?.getTime() || 0))
            .slice(0, 10)
            .map(s => ({ symbol: s.symbol, assetType: s.assetType, error: s.lastError, lastAttempt: s.lastAttemptAt }));

        const cachedTotal = await prisma.cachedResponse.count();
        const cachedStale = await prisma.cachedResponse.count({ where: { isStale: true } });

        return {
            symbols: { total: allStates.length, ready, pending, failed },
            recentFailures,
            cachedResponses: { total: cachedTotal, stale: cachedStale, fresh: cachedTotal - cachedStale }
        };
    });
}
