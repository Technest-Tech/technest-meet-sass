'use client';

import { Zap, Users, Activity, Clock } from 'lucide-react';
import StatCard from '@/lib/components/StatCard';

interface AccountStats {
  activeSessionsNow: number;
  activeParticipantsNow: number;
  totalSessions: number;
  totalParticipants: number;
  averageSessionDuration: number;
}

interface AccountStatsCardsProps {
  stats: AccountStats;
  accountEmail: string;
  clientName: string;
}

export default function AccountStatsCards({ stats, accountEmail, clientName }: AccountStatsCardsProps) {
  return (
    <div className="mb-8">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">{clientName}</h2>
        <p className="text-gray-600">{accountEmail}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="relative">
          <StatCard
            title="Active Sessions Now"
            value={stats.activeSessionsNow}
            icon={Zap}
            color="green"
            description="Currently running sessions (Live)"
          />
          <div className="absolute top-2 left-2 flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-600 font-medium">Live</span>
          </div>
        </div>

        <div className="relative">
          <StatCard
            title="Active Participants Now"
            value={stats.activeParticipantsNow}
            icon={Users}
            color="blue"
            description="Currently active participants (Live)"
          />
          <div className="absolute top-2 left-2 flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-blue-600 font-medium">Live</span>
          </div>
        </div>

        <StatCard
          title="Total Sessions"
          value={stats.totalSessions}
          icon={Activity}
          color="purple"
          description="All sessions conducted"
        />

        <StatCard
          title="Total Participants"
          value={stats.totalParticipants}
          icon={Users}
          color="indigo"
          description="Unique participants"
        />

        <StatCard
          title="Avg Session Duration"
          value={`${stats.averageSessionDuration}m`}
          icon={Clock}
          color="orange"
          description="Average session length"
        />
      </div>
    </div>
  );
}

