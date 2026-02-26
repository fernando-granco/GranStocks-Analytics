import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../services/cache';
import { HistoryWarmQueue } from '../services/history-queue';
import z from 'zod';
import bcrypt from 'bcryptjs';

/**
 * Enforces role hierarchy: ADMIN can only act on USER; SUPERADMIN can act on anyone.
 * Returns an error reply if denied, or null if allowed.
 */
async function enforceRoleHierarchy(
    actorId: string,
    targetId: string,
    reply: FastifyReply,
    requestedRole?: string
): Promise<{ actor: any; target: any } | null> {
    const [actor, target] = await Promise.all([
        prisma.user.findUnique({ where: { id: actorId } }),
        prisma.user.findUnique({ where: { id: targetId } })
    ]);
    if (!actor) { reply.status(401).send({ error: 'Actor not found' }); return null; }
    if (!target) { reply.status(404).send({ error: 'User not found' }); return null; }

    // ADMIN cannot modify another ADMIN or SUPERADMIN
    if ((target.role === 'ADMIN' || target.role === 'SUPERADMIN') && actor.role !== 'SUPERADMIN') {
        reply.status(403).send({ error: 'Permission denied: Admins cannot modify other Admins or Superadmins.' });
        return null;
    }

    // Only SUPERADMIN can assign ADMIN or SUPERADMIN roles
    if (requestedRole && requestedRole !== 'USER' && actor.role !== 'SUPERADMIN') {
        reply.status(403).send({ error: 'Permission denied: Only Superadmins can assign Admin or Superadmin roles.' });
        return null;
    }

    return { actor, target };
}

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

        // Prevent self-ban
        if (id === authUser.id && updates.status === 'BANNED') {
            return reply.status(403).send({ error: "Cannot ban yourself." });
        }

        // Enforce role hierarchy (checks both target's current role AND requested role)
        const hierarchy = await enforceRoleHierarchy(authUser.id, id, reply, updates.role);
        if (!hierarchy) return; // Reply already sent
        const { actor, target } = hierarchy;

        // Last-SUPERADMIN self-demotion protection
        if (id === authUser.id && updates.role && updates.role !== 'SUPERADMIN' && actor.role === 'SUPERADMIN') {
            const superadminCount = await prisma.user.count({ where: { role: 'SUPERADMIN' } });
            if (superadminCount <= 1) {
                return reply.status(403).send({ error: "Cannot demote — you are the last Superadmin." });
            }
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

        const hierarchy = await enforceRoleHierarchy(authUser.id, id, reply);
        if (!hierarchy) return;

        const schema = z.object({ newPassword: z.string().min(10) });
        const { newPassword } = schema.parse(req.body);

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id },
            data: { passwordHash, mustChangePassword: true }
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

        const hierarchy = await enforceRoleHierarchy(authUser.id, id, reply);
        if (!hierarchy) return;

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

        const hierarchy = await enforceRoleHierarchy(authUser.id, id, reply);
        if (!hierarchy) return;
        const { target: user } = hierarchy;

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

        const finalCode = (code || require('crypto').randomBytes(4).toString('hex')).trim().toUpperCase();
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
