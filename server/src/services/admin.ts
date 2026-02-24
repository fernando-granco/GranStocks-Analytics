import { prisma } from './cache';
import bcrypt from 'bcryptjs';

export async function bootstrapSuperAdmin() {
    const email = process.env.SUPERADMIN_EMAIL;
    const password = process.env.SUPERADMIN_PASSWORD;

    if (!email || !password) {
        console.warn('⚠️  SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD not set. Skipping superadmin bootstrap.');
        return;
    }

    try {
        const existingAdmin = await prisma.user.findUnique({
            where: { email }
        });

        if (!existingAdmin) {
            console.log(`🛡️  Creating Superadmin account for ${email}...`);
            const passwordHash = await bcrypt.hash(password, 10);
            await prisma.user.create({
                data: {
                    email,
                    passwordHash,
                    role: 'SUPERADMIN' // Always enforce SUPERADMIN role
                }
            });
            console.log('✅ Superadmin created successfully.');
        } else if (existingAdmin.role !== 'SUPERADMIN') {
            console.log(`🛡️  Elevating existing user ${email} to SUPERADMIN role...`);
            await prisma.user.update({
                where: { email },
                data: { role: 'SUPERADMIN' }
            });
            console.log('✅ User elevated to Superadmin.');
        }
    } catch (error) {
        console.error('❌ Failed to bootstrap superadmin:', error);
    }
}
