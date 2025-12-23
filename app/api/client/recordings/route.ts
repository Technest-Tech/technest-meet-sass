import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join as pathJoin } from 'path';

/**
 * GET /api/client/recordings
 * List all recordings for the authenticated client
 * Query params: page, limit, roomId, status, search
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireClient();

    if (!session.clientId) {
      return NextResponse.json(
        { error: 'معرف العميل غير موجود' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const roomId = searchParams.get('roomId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    // Build where clause - query recordings where room belongs to this client
    const where: any = {
      room: {
        clientId: session.clientId,
      },
    };

    console.log(`[Recordings API] Querying recordings for clientId: ${session.clientId}`);
    console.log(`[Recordings API] Where clause:`, JSON.stringify(where, null, 2));

    if (roomId) {
      where.roomId = roomId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { originalName: { contains: search, mode: 'insensitive' } },
        { filename: { contains: search, mode: 'insensitive' } },
        { room: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Get recordings with room info
    const [recordings, total] = await Promise.all([
      prisma.recording.findMany({
        where,
        include: {
          room: {
            select: {
              id: true,
              name: true,
              hostLink: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.recording.count({ where }),
    ]);

    console.log(`[Recordings API] Found ${recordings.length} recordings (total: ${total})`);
    
    // Fix recordings with incorrect filenames (e.g., "recording.mp4")
    // This happens when the file wasn't finalized when the recording was saved
    const recordingsDir = pathJoin(process.cwd(), 'recordings');
    
    // Get all files once to avoid repeated reads
    let allFiles: string[] = [];
    if (existsSync(recordingsDir)) {
      try {
        allFiles = await readdir(recordingsDir);
      } catch (error) {
        console.error('[Recordings API] Error reading recordings directory:', error);
      }
    }
    
    // Auto-sync orphaned files (files without database records)
    // This ensures all recording files are visible in the UI
    const mp4Files = allFiles.filter(f => f.endsWith('.mp4'));
    const existingFilenames = new Set(recordings.map(r => r.filename));
    const orphanedFiles = mp4Files.filter(f => !existingFilenames.has(f));
    
    if (orphanedFiles.length > 0) {
      console.log(`[Recordings API] Found ${orphanedFiles.length} orphaned recording files, attempting to sync...`);
      
      // Get all rooms for this client to match orphaned files
      const clientRooms = await prisma.room.findMany({
        where: { clientId: session.clientId },
        select: { id: true, name: true, hostLink: true },
      });
      
      // Try to create database records for orphaned files
      for (const filename of orphanedFiles) {
        try {
          // Extract room name from filename
          let matchedRoom = clientRooms.find(room => 
            filename.includes(room.hostLink) || filename.includes(room.name)
          );
          
          // If no match, use first room as fallback (better than nothing)
          if (!matchedRoom && clientRooms.length > 0) {
            matchedRoom = clientRooms[0];
            console.log(`[Recordings API] ⚠️ No room match for ${filename}, using fallback room: ${matchedRoom.name}`);
          }
          
          if (!matchedRoom) {
            console.warn(`[Recordings API] ⚠️ No rooms found for client, skipping orphaned file: ${filename}`);
            continue;
          }
          
          // Extract timestamp from filename
          const timestampMatch = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+)/);
          let fileStartTime = new Date();
          
          if (timestampMatch) {
            try {
              const timestampStr = timestampMatch[1];
              const isoStr = timestampStr.replace(/(\d{4}-\d{2}-\d{2}T)(\d{2})-(\d{2})-(\d{2})-(\d+)/, 
                (_, date, hour, min, sec, ms) => {
                  const msFormatted = ms.length === 3 ? ms : ms.padStart(3, '0').slice(0, 3);
                  return `${date}${hour}:${min}:${sec}.${msFormatted}Z`;
                });
              fileStartTime = new Date(isoStr);
            } catch (e) {
              console.warn(`[Recordings API] Could not parse timestamp from ${filename}`);
            }
          }
          
          // Check if recording already exists for this room at similar time
          const existingSimilar = await prisma.recording.findFirst({
            where: {
              roomId: matchedRoom.id,
              startedAt: {
                gte: new Date(fileStartTime.getTime() - 5 * 60 * 1000), // 5 minutes before
                lte: new Date(fileStartTime.getTime() + 5 * 60 * 1000), // 5 minutes after
              },
            },
          });
          
          if (existingSimilar) {
            console.log(`[Recordings API] Skipping ${filename} - similar recording exists: ${existingSimilar.id}`);
            continue;
          }
          
          // Get file stats
          const filePath = pathJoin(recordingsDir, filename);
          const fileStat = await stat(filePath);
          
          // Generate unique egressId
          const egressId = `SYNCED_${Date.now()}_${filename.substring(0, 20)}`;
          
          // Create recording record
          const syncedRecording = await prisma.recording.create({
            data: {
              roomId: matchedRoom.id,
              egressId: egressId,
              filename: filename,
              originalName: `${matchedRoom.name} - ${fileStartTime.toISOString().split('T')[0]}`,
              fileSize: fileStat.size,
              status: 'COMPLETED',
              storageType: 'LOCAL',
              storagePath: filePath,
              startedAt: fileStartTime,
              endedAt: fileStat.mtime,
            },
          });
          
          console.log(`[Recordings API] ✅ Auto-synced orphaned file: ${filename} -> recording ${syncedRecording.id}`);
          
          // Add to recordings array so it appears in this response
          recordings.push({
            ...syncedRecording,
            room: {
              id: matchedRoom.id,
              name: matchedRoom.name,
              hostLink: matchedRoom.hostLink,
            },
          });
        } catch (syncError) {
          console.error(`[Recordings API] Error syncing orphaned file ${filename}:`, syncError);
        }
      }
      
      // Re-sort recordings after adding synced ones
      recordings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      total = recordings.length;
      console.log(`[Recordings API] After sync: ${recordings.length} recordings (total: ${total})`);
    }
    
    // Track which files have been assigned to avoid duplicates
    const assignedFiles = new Set<string>();
    
    // Sort recordings by creation time (oldest first) to match files chronologically
    // This ensures each recording gets its own file in the correct order
    const sortedRecordings = [...recordings].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    const updatedRecordings = await Promise.all(
      sortedRecordings.map(async (recording) => {
        // Mark existing correct filenames as assigned to prevent duplicate assignment
        if (recording.filename && recording.filename !== 'recording.mp4' && recording.storagePath && existsSync(recording.storagePath)) {
          // File already exists and is correct - mark it as assigned
          assignedFiles.add(recording.filename);
          console.log(`[Recordings API] ✅ Recording ${recording.id} already has correct filename: ${recording.filename}`);
        }
        
        // If filename is "recording.mp4" or file doesn't exist, try to find the actual file
        if (recording.filename === 'recording.mp4' || !recording.storagePath || !existsSync(recording.storagePath)) {
          try {
            // CRITICAL: Prioritize matching by egressId (unique per recording)
            // Then try to match by room name + timestamp pattern
            let matchingFile: string | undefined;
            
            // First, try to find file by egressId (most specific)
            if (recording.egressId) {
              matchingFile = allFiles.find(file => 
                file.endsWith('.mp4') && 
                file.includes(recording.egressId) &&
                !assignedFiles.has(file) // Don't assign files that are already assigned
              );
            }
            
            // If no match by egressId, try to match by room name + created date
            if (!matchingFile && recording.room.hostLink) {
              // Try to match files that contain the room name and are close to the recording's created date
              const recordingDate = new Date(recording.createdAt);
              const dateStr = recordingDate.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
              
              matchingFile = allFiles.find(file => {
                if (!file.endsWith('.mp4') || assignedFiles.has(file)) return false;
                
                // Check if file contains room name and date pattern
                const hasRoomName = file.includes(recording.room.hostLink);
                const hasDatePattern = file.includes(dateStr) || 
                                      file.includes(recordingDate.toISOString().split('T')[0].replace(/-/g, '-'));
                
                return hasRoomName && hasDatePattern;
              });
            }
            
            // Last resort: match by room name + timestamp pattern (chronological matching)
            if (!matchingFile && recording.room.hostLink) {
              // Use startedAt instead of createdAt for better matching (startedAt is when recording actually started)
              const recordingTime = new Date(recording.startedAt).getTime();
              
              // Find files that match the room and are closest to the recording time
              const roomFiles = allFiles
                .filter(file => 
                  file.endsWith('.mp4') && 
                  file.includes(recording.room.hostLink) &&
                  !assignedFiles.has(file)
                )
                .map(file => {
                  // Try to extract timestamp from filename (format: YYYY-MM-DDTHH-MM-SS-milliseconds-roomName.mp4)
                  // Example: 2025-12-22T16-20-14-817Z-9h3t0u5.mp4
                  const timestampMatch = file.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+)/);
                  let fileTime = 0;
                  
                  if (timestampMatch) {
                    try {
                      // Parse the timestamp: 2025-12-22T16-20-14-817 -> 2025-12-22T16:20:14.817
                      const timestampStr = timestampMatch[1];
                      // Replace dashes in time with colons, keep milliseconds
                      const isoStr = timestampStr.replace(/(\d{4}-\d{2}-\d{2}T)(\d{2})-(\d{2})-(\d{2})-(\d+)/, 
                        (_, date, hour, min, sec, ms) => {
                          // Convert milliseconds (3 digits) to proper format
                          const msFormatted = ms.length === 3 ? ms : ms.padStart(3, '0').slice(0, 3);
                          return `${date}${hour}:${min}:${sec}.${msFormatted}Z`;
                        });
                      fileTime = new Date(isoStr).getTime();
                    } catch (e) {
                      // If parsing fails, try simpler format
                      try {
                        const simpleMatch = file.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
                        if (simpleMatch) {
                          const simpleStr = simpleMatch[1].replace(/(\d{4}-\d{2}-\d{2}T)(\d{2})-(\d{2})-(\d{2})/, 
                            '$1$2:$3:$4');
                          fileTime = new Date(simpleStr).getTime();
                        }
                      } catch (e2) {
                        // If all parsing fails, fileTime remains 0
                      }
                    }
                  }
                  
                  return { 
                    file, 
                    time: fileTime, 
                    diff: fileTime > 0 ? Math.abs(fileTime - recordingTime) : Infinity 
                  };
                })
                .filter(f => f.diff !== Infinity) // Only files with valid timestamps
                .sort((a, b) => a.diff - b.diff); // Sort by time difference (closest first)
              
              if (roomFiles.length > 0) {
                matchingFile = roomFiles[0].file;
                console.log(`[Recordings API] ✅ Matched by timestamp (diff: ${Math.round(roomFiles[0].diff / 1000)}s): ${matchingFile}`);
              } else {
                // If no timestamp match, use file modification time as last resort
                console.log(`[Recordings API] ⚠️ No timestamp match, trying file modification time...`);
                const roomFilesByMtime = await Promise.all(
                  allFiles
                    .filter(file => 
                      file.endsWith('.mp4') && 
                      file.includes(recording.room.hostLink) &&
                      !assignedFiles.has(file)
                    )
                    .map(async (file) => {
                      try {
                        const filePath = pathJoin(recordingsDir, file);
                        const fileStat = await stat(filePath);
                        const fileTime = fileStat.mtime.getTime();
                        const diff = Math.abs(fileTime - recordingTime);
                        return { file, time: fileTime, diff };
                      } catch {
                        return { file, time: 0, diff: Infinity };
                      }
                    })
                );
                
                const sortedByMtime = roomFilesByMtime
                  .filter(f => f.diff !== Infinity)
                  .sort((a, b) => a.diff - b.diff);
                
                if (sortedByMtime.length > 0) {
                  matchingFile = sortedByMtime[0].file;
                  console.log(`[Recordings API] ✅ Matched by file modification time (diff: ${Math.round(sortedByMtime[0].diff / 1000)}s): ${matchingFile}`);
                } else {
                  // Absolute last resort: use alphabetical order (which should be chronological for ISO timestamps)
                  const fallbackFiles = allFiles
                    .filter(file => 
                      file.endsWith('.mp4') && 
                      file.includes(recording.room.hostLink) &&
                      !assignedFiles.has(file)
                    )
                    .sort(); // Alphabetical = chronological for ISO timestamps
                  
                  if (fallbackFiles.length > 0) {
                    matchingFile = fallbackFiles[0];
                    console.log(`[Recordings API] ⚠️ Using fallback alphabetical match: ${matchingFile}`);
                  }
                }
              }
            }
            
            if (matchingFile) {
              const correctPath = pathJoin(recordingsDir, matchingFile);
              const fileStat = await stat(correctPath);
              
              // CRITICAL: Mark this file as assigned BEFORE updating database to prevent race conditions
              assignedFiles.add(matchingFile);
              
              console.log(`[Recordings API] 📝 Assigning file ${matchingFile} to recording ${recording.id}`);
              console.log(`  - Recording egressId: ${recording.egressId}`);
              console.log(`  - Recording startedAt: ${recording.startedAt}`);
              console.log(`  - File size: ${fileStat.size} bytes`);
              console.log(`  - Assigned files so far: ${Array.from(assignedFiles).join(', ')}`);
              
              // Update the database record with the correct filename
              await prisma.recording.update({
                where: { id: recording.id },
                data: {
                  filename: matchingFile,
                  storagePath: correctPath,
                  fileSize: fileStat.size,
                },
              });
              
              console.log(`[Recordings API] ✅ Updated recording ${recording.id} (egressId: ${recording.egressId}) with filename: ${matchingFile}`);
              
              return {
                ...recording,
                filename: matchingFile,
                storagePath: correctPath,
                fileSize: fileStat.size,
              };
            } else {
              console.warn(`[Recordings API] ⚠️ Could not find matching file for recording ${recording.id}`);
              console.warn(`  - egressId: ${recording.egressId}`);
              console.warn(`  - room: ${recording.room.hostLink}`);
              console.warn(`  - startedAt: ${recording.startedAt}`);
              console.warn(`  - Available files: ${allFiles.filter(f => f.endsWith('.mp4') && f.includes(recording.room.hostLink)).join(', ')}`);
              console.warn(`  - Already assigned: ${Array.from(assignedFiles).join(', ')}`);
            }
          } catch (error) {
            console.error(`[Recordings API] Error fixing filename for recording ${recording.id}:`, error);
          }
        }
        return recording;
      })
    );
    
    // Debug: Log first recording if any
    if (updatedRecordings.length > 0) {
      console.log(`[Recordings API] First recording:`, {
        id: updatedRecordings[0].id,
        roomId: updatedRecordings[0].roomId,
        roomName: updatedRecordings[0].room.name,
        filename: updatedRecordings[0].filename,
      });
    } else {
      console.log(`[Recordings API] No recordings found. Checking if any recordings exist for this client...`);
      // Debug query: check if there are any recordings at all for this client
      const allRecordingsForClient = await prisma.recording.findMany({
        where: {
          room: {
            clientId: session.clientId,
          },
        },
        select: {
          id: true,
          roomId: true,
          egressId: true,
          filename: true,
          status: true,
          room: {
            select: {
              id: true,
              name: true,
              clientId: true,
            },
          },
        },
        take: 5,
      });
      console.log(`[Recordings API] Debug: Found ${allRecordingsForClient.length} recordings for client (unfiltered):`, allRecordingsForClient);
    }

    // Format response
    const formattedRecordings = updatedRecordings.map((recording) => ({
      id: recording.id,
      roomId: recording.roomId,
      roomName: recording.room.name,
      egressId: recording.egressId,
      filename: recording.filename,
      originalName: recording.originalName,
      fileSize: recording.fileSize,
      duration: recording.duration,
      status: recording.status,
      storageType: recording.storageType,
      storagePath: recording.storagePath,
      startedAt: recording.startedAt.toISOString(),
      endedAt: recording.endedAt?.toISOString() || null,
      createdAt: recording.createdAt.toISOString(),
      // Ensure unique stream URL with recording ID and timestamp to prevent caching issues
      streamUrl: `/api/client/recordings/${recording.id}/stream?recordingId=${recording.id}&filename=${encodeURIComponent(recording.filename)}`,
      downloadUrl: `/api/client/recordings/${recording.id}/download`,
    }));
    
    // Debug: Log all recordings with their unique identifiers
    console.log(`[Recordings API] Formatted ${formattedRecordings.length} recordings:`, 
      formattedRecordings.map(r => ({
        id: r.id,
        egressId: r.egressId,
        filename: r.filename,
        streamUrl: r.streamUrl,
        startedAt: r.startedAt,
      }))
    );

    return NextResponse.json({
      recordings: formattedRecordings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Get recordings error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب التسجيلات' },
      { status: 500 }
    );
  }
}

