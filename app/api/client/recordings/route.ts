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
    let [recordings, total] = await Promise.all([
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

    console.log(`[Recordings API] Query Results:`);
    console.log(`  - Recordings found in query: ${recordings.length}`);
    console.log(`  - Total recordings in DB: ${total}`);
    console.log(`  - Query filters:`, {
      clientId: session.clientId,
      roomId: roomId || 'none',
      status: status || 'none',
      search: search || 'none',
      page,
      limit,
    });
    
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
          
          // Get file stats first (needed for matching)
          const filePath = pathJoin(recordingsDir, filename);
          let fileStat;
          try {
            fileStat = await stat(filePath);
          } catch (statError) {
            console.warn(`[Recordings API] Could not get file stats for ${filename}, skipping`);
            continue;
          }
          
          // Extract timestamp from filename
          const timestampMatch = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+)/);
          let fileStartTime = fileStat.mtime; // Use file modification time as fallback
          
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
              console.warn(`[Recordings API] Could not parse timestamp from ${filename}, using file mtime`);
            }
          }
          
          // Check for existing recording matches using multiple criteria
          // 1. Check by exact filename match
          let existingRecording = await prisma.recording.findFirst({
            where: {
              filename: filename,
            },
            include: {
              room: {
                select: {
                  id: true,
                  name: true,
                  hostLink: true,
                  clientId: true,
                },
              },
            },
          });
          
          // 2. If no filename match, check by timestamp + file size (within 5 minutes, same size)
          if (!existingRecording) {
            const timeWindowStart = new Date(fileStartTime.getTime() - 5 * 60 * 1000);
            const timeWindowEnd = new Date(fileStartTime.getTime() + 5 * 60 * 1000);
            
            existingRecording = await prisma.recording.findFirst({
              where: {
                roomId: matchedRoom.id,
                fileSize: fileStat.size, // Exact file size match
                startedAt: {
                  gte: timeWindowStart,
                  lte: timeWindowEnd,
                },
              },
              include: {
                room: {
                  select: {
                    id: true,
                    name: true,
                    hostLink: true,
                    clientId: true,
                  },
                },
              },
            });
            
            if (existingRecording) {
              console.log(`[Recordings API] Found existing recording by timestamp+size match: ${existingRecording.id} for file ${filename}`);
            }
          }
          
          if (existingRecording) {
            // Check if it belongs to this client
            if (existingRecording.room.clientId !== session.clientId) {
              console.log(`[Recordings API] Skipping ${filename} - existing recording belongs to different client`);
              continue;
            }
            
            // Update existing recording if filename is missing or incorrect
            if (existingRecording.filename !== filename || !existingRecording.storagePath || !existsSync(existingRecording.storagePath)) {
              console.log(`[Recordings API] Updating existing recording ${existingRecording.id} with correct filename: ${filename}`);
              try {
                existingRecording = await prisma.recording.update({
                  where: { id: existingRecording.id },
                  data: {
                    filename: filename,
                    storagePath: filePath,
                    fileSize: fileStat.size,
                    // Update endedAt if file is newer
                    endedAt: fileStat.mtime > (existingRecording.endedAt || existingRecording.startedAt) 
                      ? fileStat.mtime 
                      : existingRecording.endedAt,
                  },
                  include: {
                    room: {
                      select: {
                        id: true,
                        name: true,
                        hostLink: true,
                        clientId: true,
                      },
                    },
                  },
                });
                console.log(`[Recordings API] ✅ Updated recording ${existingRecording.id} with file ${filename}`);
              } catch (updateError) {
                console.error(`[Recordings API] Error updating recording ${existingRecording.id}:`, updateError);
              }
            } else {
              console.log(`[Recordings API] Recording ${existingRecording.id} already has correct filename: ${filename}`);
            }
            
            // Add existing recording to the list if not already present
            if (!recordings.find(r => r.id === existingRecording!.id)) {
              recordings.push(existingRecording);
            }
            continue;
          }
          
          // No existing recording found - create new one
          // Generate unique egressId (check for uniqueness)
          let egressId = `SYNCED_${Date.now()}_${filename.substring(0, 20)}`;
          let attempts = 0;
          while (attempts < 5) {
            const existing = await prisma.recording.findUnique({
              where: { egressId },
            });
            if (!existing) break;
            egressId = `SYNCED_${Date.now()}_${Math.random().toString(36).substring(7)}_${filename.substring(0, 15)}`;
            attempts++;
          }
          
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
            include: {
              room: {
                select: {
                  id: true,
                  name: true,
                  hostLink: true,
                },
              },
            },
          });
          
          console.log(`[Recordings API] ✅ Auto-synced orphaned file: ${filename} -> recording ${syncedRecording.id}`);
          
          // Add to recordings array so it appears in this response
          recordings.push(syncedRecording);
        } catch (syncError) {
          console.error(`[Recordings API] Error syncing orphaned file ${filename}:`, syncError);
        }
      }
      
      // Re-sort recordings after adding synced ones
      recordings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Remove duplicates by ID (in case same recording was added multiple times)
      const uniqueRecordings = new Map();
      for (const rec of recordings) {
        if (!uniqueRecordings.has(rec.id)) {
          uniqueRecordings.set(rec.id, rec);
        }
      }
      recordings = Array.from(uniqueRecordings.values());
      
      // Update total count
      total = await prisma.recording.count({
        where: {
          room: {
            clientId: session.clientId,
          },
        },
      });
      
      console.log(`[Recordings API] After sync: ${recordings.length} unique recordings (total in DB: ${total})`);
    }
    
    // Track which files have been assigned to avoid duplicates
    // Create reverse map: file -> recording to prevent conflicts
    const assignedFiles = new Set<string>();
    const fileToRecordingMap = new Map<string, string>(); // file -> recordingId
    
    // Sort recordings by creation time (oldest first) to match files chronologically
    // This ensures each recording gets its own file in the correct order
    const sortedRecordings = [...recordings].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    // First pass: Mark files that are already correctly assigned
    for (const recording of sortedRecordings) {
      if (recording.filename && recording.filename !== 'recording.mp4' && recording.storagePath && existsSync(recording.storagePath)) {
        // File already exists and is correct - mark it as assigned
        assignedFiles.add(recording.filename);
        fileToRecordingMap.set(recording.filename, recording.id);
        console.log(`[Recordings API] ✅ Recording ${recording.id} already has correct filename: ${recording.filename}`);
      }
    }
    
    const updatedRecordings = await Promise.all(
      sortedRecordings.map(async (recording) => {
        // Skip if already has correct file
        if (recording.filename && recording.filename !== 'recording.mp4' && recording.storagePath && existsSync(recording.storagePath)) {
          return recording;
        }
        
        // If filename is "recording.mp4" or file doesn't exist, try to find the actual file
        if (recording.filename === 'recording.mp4' || !recording.storagePath || !existsSync(recording.storagePath)) {
          try {
            // CRITICAL: Prioritize matching by egressId (unique per recording)
            // Then try to match by room name + timestamp pattern
            let matchingFile: string | undefined;
            
            // First, try to find file by egressId (most specific and reliable)
            if (recording.egressId) {
              matchingFile = allFiles.find(file => {
                if (!file.endsWith('.mp4') || assignedFiles.has(file)) return false;
                // Check if file contains egressId
                const hasEgressId = file.includes(recording.egressId);
                if (hasEgressId) {
                  console.log(`[Recordings API] 🎯 Found file by egressId match: ${file} for recording ${recording.id} (egressId: ${recording.egressId})`);
                }
                return hasEgressId;
              });
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
              // Defensive check: use createdAt as fallback if startedAt is missing
              const startTime = recording.startedAt || recording.createdAt;
              const recordingTime = new Date(startTime).getTime();
              
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
              // Check if this file is already assigned to a different recording
              const existingRecordingId = fileToRecordingMap.get(matchingFile);
              if (existingRecordingId && existingRecordingId !== recording.id) {
                console.warn(`[Recordings API] ⚠️ File ${matchingFile} is already assigned to recording ${existingRecordingId}, skipping assignment to ${recording.id}`);
                // Don't assign - continue to look for another file or leave unmatched
                matchingFile = undefined;
              } else {
                const correctPath = pathJoin(recordingsDir, matchingFile);
                const fileStat = await stat(correctPath);
                
                // CRITICAL: Mark this file as assigned BEFORE updating database to prevent race conditions
                assignedFiles.add(matchingFile);
                fileToRecordingMap.set(matchingFile, recording.id);
                
                console.log(`[Recordings API] 📝 Assigning file ${matchingFile} to recording ${recording.id}`);
                console.log(`  - Recording egressId: ${recording.egressId}`);
                console.log(`  - Recording startedAt: ${recording.startedAt}`);
                console.log(`  - File size: ${fileStat.size} bytes`);
                console.log(`  - Matching method: ${recording.egressId && matchingFile.includes(recording.egressId) ? 'egressId' : 'timestamp/room'}`);
                
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
              }
            }
            
            // If no matching file found, log detailed warning but still return the recording
            if (!matchingFile) {
              console.warn(`[Recordings API] ⚠️ Could not find matching file for recording ${recording.id}`);
              console.warn(`  - egressId: ${recording.egressId || 'N/A'}`);
              console.warn(`  - room: ${recording.room?.hostLink || 'N/A'}`);
              console.warn(`  - startedAt: ${recording.startedAt || 'N/A'}`);
              console.warn(`  - current filename: ${recording.filename || 'N/A'}`);
              const availableFiles = allFiles.filter(f => f.endsWith('.mp4') && recording.room?.hostLink && f.includes(recording.room.hostLink));
              console.warn(`  - Available files for room: ${availableFiles.length > 0 ? availableFiles.join(', ') : 'none'}`);
              console.warn(`  - Already assigned files: ${Array.from(assignedFiles).join(', ') || 'none'}`);
            }
          } catch (error) {
            console.error(`[Recordings API] Error fixing filename for recording ${recording.id}:`, error);
          }
        }
        return recording;
      })
    );
    
    // Phase 2 & 4: Validation and logging for unmatched files and recordings
    const recordingsWithFiles = updatedRecordings.filter(r => 
      r.filename && r.filename !== 'recording.mp4' && r.storagePath && existsSync(r.storagePath)
    );
    const recordingsWithoutFiles = updatedRecordings.filter(r => 
      !r.filename || r.filename === 'recording.mp4' || !r.storagePath || !existsSync(r.storagePath)
    );
    
    // Find files that weren't assigned to any recording
    const unassignedFiles = allFiles.filter(file => 
      file.endsWith('.mp4') && !assignedFiles.has(file)
    );
    
    // Log comprehensive summary
    console.log(`[Recordings API] 📊 File Matching Summary:`);
    console.log(`  - Total recordings: ${updatedRecordings.length}`);
    console.log(`  - Recordings with files: ${recordingsWithFiles.length}`);
    console.log(`  - Recordings without files: ${recordingsWithoutFiles.length}`);
    console.log(`  - Total files in directory: ${allFiles.filter(f => f.endsWith('.mp4')).length}`);
    console.log(`  - Assigned files: ${assignedFiles.size}`);
    console.log(`  - Unassigned files: ${unassignedFiles.length}`);
    
    if (recordingsWithoutFiles.length > 0) {
      console.warn(`[Recordings API] ⚠️ ${recordingsWithoutFiles.length} recordings without matching files:`);
      recordingsWithoutFiles.forEach(r => {
        console.warn(`  - Recording ${r.id} (egressId: ${r.egressId || 'N/A'}, filename: ${r.filename || 'N/A'})`);
      });
    }
    
    if (unassignedFiles.length > 0) {
      console.warn(`[Recordings API] ⚠️ ${unassignedFiles.length} files not assigned to any recording:`);
      unassignedFiles.slice(0, 10).forEach(file => {
        console.warn(`  - ${file}`);
      });
      if (unassignedFiles.length > 10) {
        console.warn(`  - ... and ${unassignedFiles.length - 10} more files`);
      }
    }
    
    // Debug: Log first recording if any
    if (updatedRecordings.length > 0) {
      console.log(`[Recordings API] First recording:`, {
        id: updatedRecordings[0].id,
        roomId: updatedRecordings[0].roomId,
        roomName: updatedRecordings[0].room.name,
        filename: updatedRecordings[0].filename,
        hasFile: updatedRecordings[0].filename && updatedRecordings[0].filename !== 'recording.mp4' && updatedRecordings[0].storagePath && existsSync(updatedRecordings[0].storagePath),
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

    // Format response - include ALL recordings, even if file matching failed
    const formattedRecordings = updatedRecordings.map((recording) => {
      // Defensive checks for required fields
      const startedAt = recording.startedAt || recording.createdAt;
      
      // Check if file actually exists
      const fileExists = recording.filename && 
                        recording.filename !== 'recording.mp4' && 
                        recording.storagePath && 
                        existsSync(recording.storagePath);
      
      return {
        id: recording.id,
        roomId: recording.roomId,
        roomName: recording.room?.name || 'Unknown Room',
        egressId: recording.egressId,
        filename: recording.filename || 'recording.mp4',
        originalName: recording.originalName || recording.filename || 'Recording',
        fileSize: recording.fileSize,
        duration: recording.duration,
        status: recording.status,
        storageType: recording.storageType,
        storagePath: recording.storagePath,
        startedAt: startedAt.toISOString(),
        endedAt: recording.endedAt?.toISOString() || null,
        createdAt: recording.createdAt.toISOString(),
        fileExists: fileExists, // Flag indicating if file actually exists
        // Ensure unique stream URL with recording ID and timestamp to prevent caching issues
        streamUrl: `/api/client/recordings/${recording.id}/stream?recordingId=${recording.id}&filename=${encodeURIComponent(recording.filename || 'recording.mp4')}`,
        downloadUrl: `/api/client/recordings/${recording.id}/download`,
      };
    });
    
    // Log display summary
    console.log(`[Recordings API] 📋 Display Summary:`);
    console.log(`  - Total recordings to display: ${formattedRecordings.length}`);
    console.log(`  - Recordings with existing files: ${formattedRecordings.filter(r => r.fileExists).length}`);
    console.log(`  - Recordings without files: ${formattedRecordings.filter(r => !r.fileExists).length}`);
    
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      error: error,
    });
    return NextResponse.json(
      { 
        error: 'حدث خطأ أثناء جلب التسجيلات',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

