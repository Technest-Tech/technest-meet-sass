import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { sanitizeRoomIdentifier, sanitizeString, sanitizeFilename, detectCommandInjection } from '@/lib/utils/sanitize';
import { logCommandInjectionAttempt } from '@/lib/utils/securityLogger';

// POST - Save chat transcript to server (optional feature)
export async function POST(request: NextRequest) {
  try {
    const { roomName, transcript, participantName } = await request.json();
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!roomName || !transcript) {
      return NextResponse.json(
        { error: 'Room name and transcript are required' },
        { status: 400 }
      );
    }

    // Check for command injection attempts
    if (detectCommandInjection(roomName) || 
        detectCommandInjection(transcript) || 
        (participantName && detectCommandInjection(participantName))) {
      logCommandInjectionAttempt(ip, userAgent, 'chat transcript save');
      return NextResponse.json(
        { error: 'Invalid input detected' },
        { status: 400 }
      );
    }

    // Sanitize all inputs
    const sanitizedRoomName = sanitizeRoomIdentifier(roomName);
    const sanitizedParticipantName = participantName ? sanitizeString(participantName) : 'transcript';
    const sanitizedTranscript = sanitizeString(transcript);

    // Create transcripts directory if it doesn't exist
    const transcriptsDir = path.join(process.cwd(), 'public', 'transcripts');
    if (!fs.existsSync(transcriptsDir)) {
      fs.mkdirSync(transcriptsDir, { recursive: true });
    }

    // Create filename with timestamp - use sanitized values
    const timestamp = Date.now();
    const safeFilename = sanitizeFilename(`${sanitizedRoomName}-${sanitizedParticipantName}-${timestamp}.txt`);
    const filepath = path.join(transcriptsDir, safeFilename);

    // Validate filepath to prevent path traversal
    if (!filepath.startsWith(transcriptsDir)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }

    // Write transcript to file
    fs.writeFileSync(filepath, sanitizedTranscript, 'utf8');

    return NextResponse.json({
      success: true,
      message: 'Transcript saved successfully',
      filename: safeFilename,
      url: `/transcripts/${safeFilename}`
    });

  } catch (error) {
    console.error('Failed to save transcript:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

