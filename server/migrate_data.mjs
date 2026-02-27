import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function migrate() {
    const users = await prisma.user.findMany();
    for (const user of users) {
        // Check if user already has a portfolio
        let portfolio = await prisma.portfolio.findFirst({
            where: { userId: user.id, name: 'Main Portfolio' }
        });

        if (!portfolio) {
            console.log(`Creating Main Portfolio for user ${user.email}`);
            portfolio = await prisma.portfolio.create({
                data: {
                    userId: user.id,
                    name: 'Main Portfolio',
                    baseCurrency: 'USD'
                }
            });
        }

        const positions = await prisma.portfolioPosition.findMany({
            where: { userId: user.id, portfolioId: null }
        });

        if (positions.length > 0) {
            console.log(`Migrating ${positions.length} positions for user ${user.email}`);
            await prisma.portfolioPosition.updateMany({
                where: { userId: user.id, portfolioId: null },
                data: { portfolioId: portfolio.id }
            });
        }
    }
}

migrate()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
