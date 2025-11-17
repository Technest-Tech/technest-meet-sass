import path from 'path';
import { existsSync } from 'fs';
import { mkdir, rename } from 'fs/promises';
import { PrismaClient } from '@prisma/client';
import { getUploadRoot, getRoomUploadPath } from '../lib/utils/storage';

const prisma = new PrismaClient();

async function main() {
  const legacyRoot = path.join(process.cwd(), 'public', 'uploads');
  const uploadRoot = getUploadRoot();

  if (!existsSync(legacyRoot)) {
    console.log('Legacy uploads directory not found. Nothing to migrate.');
    return;
  }

  await mkdir(uploadRoot, { recursive: true });

  const rooms = await prisma.room.findMany({
    select: { id: true, name: true },
  });

  console.log(`Scanning ${rooms.length} rooms for legacy folders...`);

  for (const room of rooms) {
    const legacyPath = path.join(legacyRoot, room.name);
    if (!existsSync(legacyPath)) {
      continue;
    }

    const targetPath = getRoomUploadPath(room.id);

    if (legacyPath === targetPath) {
      continue;
    }

    if (existsSync(targetPath)) {
      console.warn(
        `[SKIP] Destination ${targetPath} already exists for room "${room.name}" (${room.id}). Merge manually if needed.`,
      );
      continue;
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    await rename(legacyPath, targetPath);
    console.log(`[MOVED] ${legacyPath} -> ${targetPath}`);
  }

  console.log('Migration complete.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

