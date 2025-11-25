import { PrismaClient, AccountRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const accounts = await prisma.account.findMany({
      where: { role: AccountRole.CLIENT },
      include: {
        client: {
          include: {
            subscription: {
              include: {
                plan: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    console.log('Accounts:', accounts.length);

    const clientIds = accounts
      .map((account) => account.client?.id)
      .filter((id): id is string => Boolean(id));

    const storageSnapshots = await prisma.storageSnapshot.findMany({
      where: {
        clientId: { in: clientIds },
      },
    });

    console.log('Snapshots:', storageSnapshots.length);
  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

