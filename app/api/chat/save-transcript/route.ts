import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// POST - Save chat transcript to server (optional feature)
export async function POST(request: NextRequest) {
  try {
    const { roomName, transcript, participantName } = await request.json();

    if (!roomName || !transcript) {
      return NextResponse.json(
        { error: 'Room name and transcript are required' },
        { status: 400 }
      );
    }

    // Create transcripts directory if it doesn't exist
    const transcriptsDir = path.join(process.cwd(), 'public', 'transcripts');
    if (!fs.existsSync(transcriptsDir)) {
      fs.mkdirSync(transcriptsDir, { recursive: true });
    }

    // Create filename with timestamp
    const timestamp = Date.now();
    const filename = `${roomName}-${participantName || 'transcript'}-${timestamp}.txt`;
    const filepath = path.join(transcriptsDir, filename);

    // Write transcript to file
    fs.writeFileSync(filepath, transcript, 'utf8');

    return NextResponse.json({
      success: true,
      message: 'Transcript saved successfully',
      filename,
      url: `/transcripts/${filename}`
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

