'use client';

import { Activity, Users, Zap } from 'lucide-react';
import StatCard from '@/lib/components/StatCard';

interface SessionStats {
  active: number;
  today: number;
  totalParticipants: number;
  averageDuration: number;
  peakHours: { hour: number; count: number }[];
}

interface RealtimeStats {
  activeSessions: number;
  totalParticipants: number;
  timestamp: string;
}

interface SessionStatsCardsProps {
  stats: SessionStats;
  roomsUtilization?: number; // Kept for backward compatibility but no longer used
  realtimeStats?: RealtimeStats;
}

export default function SessionStatsCards({ stats, realtimeStats }: SessionStatsCardsProps) {
  // Use real-time stats if available, otherwise fall back to regular stats
  const activeSessions = realtimeStats?.activeSessions ?? stats.active;
  const totalParticipants = realtimeStats?.totalParticipants ?? stats.totalParticipants;
  const isRealtime = realtimeStats !== undefined;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <div className="relative">
        <StatCard
          title="Active Sessions"
          value={activeSessions}
          icon={Zap}
          color="green"
          description={isRealtime ? `${activeSessions} rooms currently running (Live)` : `${activeSessions} rooms currently running`}
        />
        {isRealtime && (
          <div className="absolute top-2 left-2 flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-600 font-medium">Live</span>
          </div>
        )}
      </div>

      <div className="relative">
        <StatCard
          title="Total Participants"
          value={totalParticipants}
          icon={Users}
          color="blue"
          description={isRealtime ? `${totalParticipants} concurrent participants (Live)` : 'Active across all rooms'}
        />
        {isRealtime && (
          <div className="absolute top-2 left-2 flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-blue-600 font-medium">Live</span>
          </div>
        )}
      </div>

      <StatCard
        title="Sessions Today"
        value={stats.today}
        icon={Activity}
        color="purple"
        description="Started in last 24 hours"
      />
    </div>
  );
}

