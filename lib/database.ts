import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export async function seedDatabase() {
  try {
    // Check if admin user exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@newmeet.com' }
    });

    if (!existingAdmin) {
      // Create admin user
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await prisma.user.create({
        data: {
          email: 'admin@newmeet.com',
          password: hashedPassword,
          role: 'ADMIN'
        }
      });
      
      console.log('✅ Admin user created successfully');
    }

    console.log('✅ Database seeding completed');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
  }
}

export async function generateShortLink(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a room link based on academy name (client name) + room name
 * Format: sanitized_academy_name-sanitized_room_name
 */
export function generateRoomLink(academyName: string, roomName: string): string {
  // Sanitize academy name: lowercase, replace spaces/special chars with hyphens, remove multiple hyphens
  let sanitizedAcademy = academyName
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]/g, '-') // Allow Arabic characters
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 20); // Limit length
  
  // Remove common prefixes like "test-", "test_", "demo-", etc.
  sanitizedAcademy = sanitizedAcademy.replace(/^(test[-_]?|demo[-_]?|sample[-_]?)/i, '');
  
  // Clean up any leading hyphens after prefix removal
  sanitizedAcademy = sanitizedAcademy.replace(/^-+/, '');
  
  // Sanitize room name: lowercase, replace spaces/special chars with hyphens, remove multiple hyphens
  let sanitizedRoom = roomName
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]/g, '-') // Allow Arabic characters
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30); // Limit length
  
  // If sanitized academy name is empty, use default
  const baseName = sanitizedAcademy || 'academy';
  
  // If sanitized room name is empty, use default
  const roomPart = sanitizedRoom || 'room';
  
  return `${baseName}-${roomPart}`;
}

/**
 * Generate preview room links (client-side, for preview only)
 */
export function generatePreviewRoomLinks(academyName: string, roomName: string): { hostLink: string; guestLink: string } {
  // Sanitize academy name
  let sanitizedAcademy = academyName
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 20);
  
  // Remove common prefixes like "test-", "test_", "demo-", etc.
  sanitizedAcademy = sanitizedAcademy.replace(/^(test[-_]?|demo[-_]?|sample[-_]?)/i, '');
  
  // Clean up any leading hyphens after prefix removal
  sanitizedAcademy = sanitizedAcademy.replace(/^-+/, '');
  
  // Sanitize room name
  let sanitizedRoom = roomName
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
  
  const baseName = sanitizedAcademy || 'academy';
  const roomPart = sanitizedRoom || 'room';
  
  const link = `${baseName}-${roomPart}`;
  
  return {
    hostLink: link,
    guestLink: link,
  };
}

export async function getNextParticipantName(roomId: string, type: 'HOST' | 'GUEST'): Promise<string> {
  const prefix = type === 'HOST' ? 'Teacher' : 'Student';
  
  // Get all participants of this type in the room (both used and unused)
  const existingParticipants = await prisma.participant.findMany({
    where: {
      roomId,
      type,
      name: {
        startsWith: prefix
      }
    },
    orderBy: {
      name: 'desc'
    }
  });

  if (existingParticipants.length === 0) {
    return `${prefix}1`;
  }

  // Extract the number from the last participant name
  const lastParticipantName = existingParticipants[0].name;
  const numberMatch = lastParticipantName.match(new RegExp(`${prefix}(\\d+)`));
  
  if (!numberMatch) {
    // If no number found, start with 1
    return `${prefix}1`;
  }
  
  const lastNumber = parseInt(numberMatch[1]);
  
  if (isNaN(lastNumber)) {
    // If parsing fails, start with 1
    return `${prefix}1`;
  }
  
  // Find the next available number by checking for gaps
  let nextNumber = lastNumber + 1;
  
  // Check if there are any gaps in the numbering (due to deleted participants)
  const usedNumbers = new Set();
  
  for (const participant of existingParticipants) {
    const match = participant.name.match(new RegExp(`${prefix}(\\d+)`));
    if (match) {
      const num = parseInt(match[1]);
      if (!isNaN(num)) {
        usedNumbers.add(num);
      }
    }
  }
  
  // Find the first available number
  while (usedNumbers.has(nextNumber)) {
    nextNumber++;
  }
  
  return `${prefix}${nextNumber}`;
}
