'use client';

import { Activity, Clock, Users, TrendingUp, Zap, BarChart3 } from 'lucide-react';
import StatCard from '@/lib/components/StatCard';

interface SessionStats {
  active: number;
  today: number;
  totalParticipants: number;
  averageDuration: number;
  peakHours: { hour: number; count: number }[];
}

interface SessionStatsCardsProps {
  stats: SessionStats;
  roomsUtilization: number;
}

export default function SessionStatsCards({ stats, roomsUtilization }: SessionStatsCardsProps) {
  const peakHourText =
    stats.peakHours.length > 0
      ? `${stats.peakHours[0].hour}:00 - ${stats.peakHours[0].hour + 1}:00`
      : 'N/A';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <StatCard
        title="Active Sessions"
        value={stats.active}
        icon={Zap}
        color="green"
        description={`${stats.active} rooms currently running`}
      />

      <StatCard
        title="Total Participants"
        value={stats.totalParticipants}
        icon={Users}
        color="blue"
        description="Active across all rooms"
      />

      <StatCard
        title="Sessions Today"
        value={stats.today}
        icon={Activity}
        color="purple"
        description="Started in last 24 hours"
      />

      <StatCard
        title="Avg Duration"
        value={`${stats.averageDuration}m`}
        icon={Clock}
        color="indigo"
        description="Average session length"
      />

      <StatCard
        title="Rooms Utilization"
        value={`${roomsUtilization.toFixed(1)}%`}
        icon={BarChart3}
        color="orange"
        description="Active vs total rooms"
      />

      <StatCard
        title="Peak Hours"
        value={peakHourText}
        icon={TrendingUp}
        color="red"
        description="Most active time"
      />
    </div>
  );
}

