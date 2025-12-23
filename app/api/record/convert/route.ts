import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  let inputPath: string | null = null;
  let outputPath: string | null = null;
  
  try {
    const formData = await req.formData();
    const file = formData.get('video') as File;
    
    if (!file) {
      return new NextResponse(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check file type
    if (!file.type.includes('webm') && !file.name.endsWith('.webm')) {
      return new NextResponse(
        JSON.stringify({ error: 'File must be WebM format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create temp directory if it doesn't exist
    const tempDir = join(tmpdir(), 'almajd-recordings');
    try {
      await mkdir(tempDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore
    }

    const timestamp = Date.now();
    inputPath = join(tempDir, `input-${timestamp}.webm`);
    outputPath = join(tempDir, `output-${timestamp}.mp4`);
    
    // Save uploaded file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buffer);
    
    // Check if FFmpeg is available
    try {
      await execAsync('ffmpeg -version');
    } catch (error) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'FFmpeg is not installed on the server',
          details: 'Please install FFmpeg: apt-get install ffmpeg (Linux) or brew install ffmpeg (macOS)'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Convert using FFmpeg
    // -c:v libx264: Use H.264 video codec
    // -c:a aac: Use AAC audio codec
    // -preset fast: Balance between speed and compression
    // -movflags +faststart: Enable fast start for web playback
    // -y: Overwrite output file if exists
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -c:v libx264 -c:a aac -preset fast -movflags +faststart -y "${outputPath}"`;
    
    try {
      await execAsync(ffmpegCommand, { 
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large files
      });
    } catch (error: any) {
      console.error('FFmpeg conversion error:', error);
      return new NextResponse(
        JSON.stringify({ 
          error: 'Conversion failed',
          details: error.message || 'FFmpeg conversion error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Read converted file
    const { readFile } = await import('fs/promises');
    const mp4Buffer = await readFile(outputPath);
    
    // Cleanup temp files
    try {
      if (inputPath) await unlink(inputPath);
      if (outputPath) await unlink(outputPath);
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp files:', cleanupError);
      // Continue anyway - files will be cleaned up by OS eventually
    }
    
    return new NextResponse(mp4Buffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="recording-${timestamp}.mp4"`,
        'Content-Length': mp4Buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Conversion endpoint error:', error);
    
    // Cleanup on error
    try {
      if (inputPath) await unlink(inputPath).catch(() => {});
      if (outputPath) await unlink(outputPath).catch(() => {});
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

