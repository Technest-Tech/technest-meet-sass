import { EgressClient, RoomServiceClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Health check endpoint for egress service
 * This helps verify that the egress service is running and connected
 */
export async function GET(req: NextRequest) {
  try {
    const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = process.env;

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      return new NextResponse(JSON.stringify({ 
        status: 'error',
        error: 'LiveKit configuration missing',
        details: 'LiveKit API credentials are not configured'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const hostURL = new URL(LIVEKIT_URL);
    // Keep the original protocol - don't force HTTPS for IP addresses
    // Production servers may use HTTP for internal API calls (port 7880)
    if (hostURL.protocol === 'http:' && 
        !hostURL.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) && 
        !hostURL.hostname.includes('localhost') && 
        !hostURL.hostname.includes('127.0.0.1')) {
      hostURL.protocol = 'https:';
    }

    const health: {
      livekitServer: 'healthy' | 'unhealthy' | 'unknown';
      egressService: 'healthy' | 'unhealthy' | 'unknown';
      details: any;
    } = {
      livekitServer: 'unknown',
      egressService: 'unknown',
      details: {}
    };

    // Check LiveKit server connectivity
    try {
      const roomServiceClient = new RoomServiceClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
      await Promise.race([
        roomServiceClient.listRooms(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
      ]);
      health.livekitServer = 'healthy';
      health.details.livekitServer = 'Connected successfully';
    } catch (error) {
      health.livekitServer = 'unhealthy';
      health.details.livekitServer = error instanceof Error ? error.message : 'Connection failed';
    }

    // Check egress service - first check health endpoint, then API
    try {
      // First check the egress health endpoint directly (port 8080)
      const egressHealthUrl = hostURL.origin.replace('ws://', 'http://').replace('wss://', 'https://').replace(':7880', ':8080');
      const healthResponse = await fetch(egressHealthUrl, {
        signal: AbortSignal.timeout(3000)
      });
      
      if (healthResponse.ok) {
        // Health endpoint is working, now test the API
        try {
          const egressClient = new EgressClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
          await Promise.race([
            egressClient.listEgress(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ]);
          health.egressService = 'healthy';
          health.details.egressService = 'Egress service is available and responding';
        } catch (apiError) {
          // API call failed but health endpoint works - service is running
          health.egressService = 'healthy';
          health.details.egressService = 'Egress service is running (health check passed)';
        }
      } else {
        health.egressService = 'unhealthy';
        health.details.egressService = 'Egress service health endpoint returned error';
      }
    } catch (error) {
      const errorString = String(error);
      
      if (errorString.includes('panic') || errorString.includes('Internal Server Error')) {
        health.egressService = 'unhealthy';
        health.details.egressService = 'Egress service encountered an internal error (panic). The service may need to be restarted.';
      } else if (errorString.includes('ECONNREFUSED') || errorString.includes('connect') || errorString.includes('fetch')) {
        health.egressService = 'unhealthy';
        health.details.egressService = 'Cannot connect to egress service. Ensure the egress service is running on port 8080.';
      } else if (errorString.includes('timeout') || errorString.includes('Timeout')) {
        health.egressService = 'unhealthy';
        health.details.egressService = 'Egress service did not respond in time. It may be overloaded or not running.';
      } else {
        health.egressService = 'unhealthy';
        health.details.egressService = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    const overallStatus = health.livekitServer === 'healthy' && health.egressService === 'healthy' 
      ? 'healthy' 
      : 'unhealthy';

    return new NextResponse(JSON.stringify({
      status: overallStatus,
      services: health,
      timestamp: new Date().toISOString(),
      recommendations: overallStatus === 'unhealthy' ? [
        health.livekitServer === 'unhealthy' ? 'Check LiveKit server is running and accessible' : null,
        health.egressService === 'unhealthy' ? 'Check egress service is running and properly configured' : null,
        'Verify LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET environment variables',
        'Check network connectivity between Next.js server and LiveKit server',
        'Review LiveKit server logs for errors'
      ].filter(Boolean) : []
    }), {
      status: overallStatus === 'healthy' ? 200 : 503,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Health check error:', error);
    return new NextResponse(JSON.stringify({
      status: 'error',
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

