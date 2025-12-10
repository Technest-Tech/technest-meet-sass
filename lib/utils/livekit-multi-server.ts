import { RoomServiceClient } from 'livekit-server-sdk';

/**
 * Get all configured LiveKit server URLs
 * Returns array of server URLs (1 or 2 servers based on configuration)
 */
export function getAllLiveKitServers(): string[] {
  // Get server URLs from environment
  const livekit1Server = process.env.LIVEKIT_1_SERVER_URL || process.env.LIVEKIT_URL || 'ws://localhost:7880';
  const livekit2Server = process.env.LIVEKIT_2_SERVER_URL;

  const servers: string[] = [livekit1Server];
  
  // Add second server if configured
  if (livekit2Server) {
    servers.push(livekit2Server);
  }

  return servers;
}

/**
 * Room data structure from a single server
 */
export interface RoomData {
  roomName: string;
  participantCount: number;
  participants: string[];
}

/**
 * Aggregated result from all servers
 */
export interface AggregatedRoomData {
  rooms: RoomData[];
  totalParticipants: number;
  activeSessions: number;
  serverBreakdown?: {
    [serverUrl: string]: {
      rooms: number;
      participants: number;
    };
  };
}

/**
 * Query a single LiveKit server and return its rooms
 * Includes timeout to prevent hanging
 */
async function querySingleServer(
  serverUrl: string,
  apiKey: string,
  apiSecret: string
): Promise<{ rooms: RoomData[]; totalParticipants: number }> {
  const rooms: RoomData[] = [];
  let totalParticipants = 0;

  try {
    // Add timeout wrapper to prevent hanging
    const queryWithTimeout = async () => {
      const roomService = new RoomServiceClient(serverUrl, apiKey, apiSecret);
      const livekitRooms = await roomService.listRooms();

      // Process rooms with individual timeouts
      const roomPromises = livekitRooms.map(async (room) => {
        try {
          // Timeout for each participant query (2 seconds per room)
          const participants = await Promise.race([
            roomService.listParticipants(room.name),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 2000)
            )
          ]) as any[];
          
          // Filter out observers from count
          const nonObserverParticipants = participants.filter((p: any) => {
            try {
              const metadata = p.metadata ? JSON.parse(p.metadata) : {};
              return metadata.type !== 'observer';
            } catch {
              // If metadata parsing fails, check identity
              return !p.identity?.toLowerCase().includes('observer');
            }
          });

          const participantCount = nonObserverParticipants.length;
          
          return {
            roomName: room.name,
            participantCount,
            participants: nonObserverParticipants.map((p: any) => p.identity || 'Unknown'),
          };
        } catch (error) {
          // Skip rooms that timeout or error
          return null;
        }
      });

      const roomResults = await Promise.all(roomPromises);
      return roomResults.filter((r): r is RoomData => r !== null);
    };

    // Overall timeout of 5 seconds for the entire server query
    const roomResults = await Promise.race([
      queryWithTimeout(),
      new Promise<RoomData[]>((_, reject) => 
        setTimeout(() => reject(new Error('Server query timeout')), 5000)
      )
    ]);

    roomResults.forEach((room) => {
      rooms.push(room);
      totalParticipants += room.participantCount;
    });
  } catch (error) {
    console.error(`Error querying LiveKit server ${serverUrl}:`, error);
    // Return empty result if server fails or times out
    return { rooms: [], totalParticipants: 0 };
  }

  return { rooms, totalParticipants };
}

/**
 * Query all configured LiveKit servers and aggregate results
 */
export async function queryAllLiveKitServers(): Promise<AggregatedRoomData> {
  const API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
  const API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';
  const servers = getAllLiveKitServers();

  // Query all servers in parallel with timeout
  const queryWithTimeout = async () => {
    return Promise.allSettled(
      servers.map(serverUrl => querySingleServer(serverUrl, API_KEY, API_SECRET))
    );
  };

  // Overall timeout of 8 seconds for all servers
  let serverResults: PromiseSettledResult<{ rooms: RoomData[]; totalParticipants: number }>[];
  try {
    serverResults = await Promise.race([
      queryWithTimeout(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Overall query timeout')), 8000)
      )
    ]);
  } catch (error) {
    // If timeout, return empty results for all servers
    serverResults = servers.map(() => ({ 
      status: 'rejected' as const, 
      reason: error instanceof Error ? error : new Error('Timeout') 
    }));
  }

  // Aggregate results
  const allRooms: RoomData[] = [];
  let totalParticipants = 0;
  const serverBreakdown: { [serverUrl: string]: { rooms: number; participants: number } } = {};

  serverResults.forEach((result, index) => {
    const serverUrl = servers[index];
    
    if (result.status === 'fulfilled') {
      const { rooms, totalParticipants: serverParticipants } = result.value;
      allRooms.push(...rooms);
      totalParticipants += serverParticipants;
      serverBreakdown[serverUrl] = {
        rooms: rooms.length,
        participants: serverParticipants,
      };
    } else {
      console.error(`Failed to query server ${serverUrl}:`, result.reason);
      serverBreakdown[serverUrl] = {
        rooms: 0,
        participants: 0,
      };
    }
  });

  // Active sessions = number of rooms with at least one non-observer participant
  const activeSessions = allRooms.filter((r) => r.participantCount > 0).length;

  return {
    rooms: allRooms,
    totalParticipants,
    activeSessions,
    serverBreakdown,
  };
}

/**
 * Query all servers and find rooms matching the provided room links
 * Used for account-specific analytics
 */
export async function queryRoomsByLinks(roomLinks: string[]): Promise<{
  activeSessions: number;
  totalParticipants: number;
  matchedRooms: RoomData[];
}> {
  const API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
  const API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';
  const servers = getAllLiveKitServers();

  // Create a set for quick lookup
  const roomLinksSet = new Set(roomLinks);
  const matchedRooms: RoomData[] = [];
  const countedRooms = new Set<string>(); // Track by room ID to avoid double counting

  // Query all servers in parallel
  const serverResults = await Promise.allSettled(
    servers.map(serverUrl => querySingleServer(serverUrl, API_KEY, API_SECRET))
  );

  // Find matching rooms across all servers
  serverResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      const { rooms } = result.value;
      
      for (const room of rooms) {
        // Check if this room matches any of the provided room links
        if (roomLinksSet.has(room.roomName) && !countedRooms.has(room.roomName)) {
          matchedRooms.push(room);
          countedRooms.add(room.roomName);
        }
      }
    }
  });

  const activeSessions = matchedRooms.filter((r) => r.participantCount > 0).length;
  const totalParticipants = matchedRooms.reduce((sum, r) => sum + r.participantCount, 0);

  return {
    activeSessions,
    totalParticipants,
    matchedRooms,
  };
}

