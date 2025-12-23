import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

/**
 * POST /api/client/recordings/sync
 * Sync recordings from filesystem to database (for recordings that were created before database save was implemented)
 * This is a one-time sync utility
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireClient();

    if (!session.clientId) {
      return NextResponse.json(
        { error: 'معرف العميل غير موجود' },
        { status: 400 }
      );
    }

    // Get all rooms for this client
    const rooms = await prisma.room.findMany({
      where: {
        clientId: session.clientId,
      },
      select: {
        id: true,
        name: true,
        hostLink: true,
      },
    });

    if (rooms.length === 0) {
      return NextResponse.json({
        message: 'No rooms found for this client',
        synced: 0,
      });
    }

    // Get all recording files from the recordings directory
    const recordingsDir = join(process.cwd(), 'recordings');
    let files: string[] = [];
    try {
      files = await readdir(recordingsDir);
    } catch (error) {
      console.error('Error reading recordings directory:', error);
      return NextResponse.json(
        { error: 'Could not read recordings directory' },
        { status: 500 }
      );
    }

    const mp4Files = files.filter(f => f.endsWith('.mp4'));
    let syncedCount = 0;
    const errors: string[] = [];
    
    // Get all existing recordings to avoid duplicates
    const existingRecordings = await prisma.recording.findMany({
      where: {
        room: {
          clientId: session.clientId,
        },
      },
      select: {
        id: true,
        filename: true,
        egressId: true,
        startedAt: true,
      },
    });
    
    const existingFilenames = new Set(existingRecordings.map(r => r.filename));
    const existingEgressIds = new Set(existingRecordings.map(r => r.egressId));

    // For each file, try to find or create a database record
    for (const filename of mp4Files) {
      try {
        // Skip if this file is already in the database
        if (existingFilenames.has(filename)) {
          console.log(`[Sync] Recording already exists for file: ${filename}`);
          continue;
        }

        // Try to extract room name from filename or match by pattern
        // Filename format: YYYY-MM-DDTHH-MM-SS-milliseconds-roomName.mp4
        const filePath = join(recordingsDir, filename);
        const fileStat = await stat(filePath);
        
        // Extract timestamp from filename for better matching
        const timestampMatch = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+)/);
        let fileStartTime = fileStat.birthtime;
        
        if (timestampMatch) {
          try {
            const timestampStr = timestampMatch[1];
            // Convert to ISO format: 2025-12-22T23-52-36-543 -> 2025-12-22T23:20:36.543Z
            const isoStr = timestampStr.replace(/(\d{4}-\d{2}-\d{2}T)(\d{2})-(\d{2})-(\d{2})-(\d+)/, 
              (_, date, hour, min, sec, ms) => {
                const msFormatted = ms.length === 3 ? ms : ms.padStart(3, '0').slice(0, 3);
                return `${date}${hour}:${min}:${sec}.${msFormatted}Z`;
              });
            fileStartTime = new Date(isoStr);
          } catch (e) {
            // If parsing fails, use file birthtime
            console.warn(`[Sync] Could not parse timestamp from ${filename}, using file birthtime`);
          }
        }
        
        // Try to find a room that might match this recording
        let matchedRoom = rooms[0]; // Default to first room
        
        // Try to match by room name in filename
        for (const room of rooms) {
          if (filename.includes(room.name) || filename.includes(room.hostLink)) {
            matchedRoom = room;
            break;
          }
        }
        
        // Check if there's already a recording for this room at a similar time (within 5 minutes)
        // This helps avoid creating duplicate records for the same recording
        const similarRecording = existingRecordings.find(rec => {
          if (rec.startedAt) {
            const timeDiff = Math.abs(new Date(rec.startedAt).getTime() - fileStartTime.getTime());
            return timeDiff < 5 * 60 * 1000; // 5 minutes
          }
          return false;
        });
        
        if (similarRecording) {
          console.log(`[Sync] Skipping ${filename} - similar recording already exists: ${similarRecording.id} (${similarRecording.filename})`);
          continue;
        }

        // Generate unique egressId
        let egressId = `SYNCED_${Date.now()}_${filename}`;
        let attempts = 0;
        while (existingEgressIds.has(egressId) && attempts < 10) {
          egressId = `SYNCED_${Date.now()}_${Math.random().toString(36).substring(7)}_${filename}`;
          attempts++;
        }
        
        if (existingEgressIds.has(egressId)) {
          console.warn(`[Sync] Could not generate unique egressId for ${filename}, skipping`);
          continue;
        }

        // Create recording record
        const recording = await prisma.recording.create({
          data: {
            roomId: matchedRoom.id,
            egressId: egressId,
            filename: filename,
            originalName: `${matchedRoom.name}_${fileStartTime.toISOString().replace(/[:.]/g, '-').split('T')[0]}.mp4`,
            fileSize: fileStat.size,
            status: 'COMPLETED',
            storageType: 'LOCAL',
            storagePath: filePath,
            startedAt: fileStartTime,
            endedAt: fileStat.mtime,
          },
        });

        // Add to existing sets to avoid duplicates in this sync run
        existingFilenames.add(filename);
        existingEgressIds.add(egressId);
        
        console.log(`[Sync] ✅ Created recording record: ${recording.id} for file ${filename}`);
        syncedCount++;
      } catch (error: any) {
        console.error(`[Sync] Error syncing file ${filename}:`, error);
        errors.push(`${filename}: ${error.message}`);
      }
    }

    return NextResponse.json({
      message: `Synced ${syncedCount} recordings`,
      synced: syncedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Sync recordings error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء مزامنة التسجيلات' },
      { status: 500 }
    );
  }
}

