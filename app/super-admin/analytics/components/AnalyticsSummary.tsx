'use client';

import { Users, Monitor, Smartphone, Tablet, Globe, Laptop } from 'lucide-react';
import StatCard from '@/lib/components/StatCard';

interface AnalyticsSummaryProps {
  summary: {
    deviceTypes: { desktop: number; mobile: number; tablet: number; unknown: number };
    browsers: Record<string, number>;
    operatingSystems: Record<string, number>;
    totalParticipants: number;
  };
}

export default function AnalyticsSummary({ summary }: AnalyticsSummaryProps) {
  const total = summary.totalParticipants;
  const deviceTypes = summary.deviceTypes;

  // Find most common device type
  const deviceTypeEntries = Object.entries(deviceTypes).filter(([_, count]) => count > 0);
  const mostCommonDevice = deviceTypeEntries.length > 0
    ? deviceTypeEntries.reduce((a, b) => (a[1] > b[1] ? a : b))[0]
    : 'N/A';

  // Find most common browser
  const browserEntries = Object.entries(summary.browsers);
  const mostCommonBrowser = browserEntries.length > 0
    ? browserEntries.reduce((a, b) => (a[1] > b[1] ? a : b))[0]
    : 'N/A';

  // Find most common OS
  const osEntries = Object.entries(summary.operatingSystems);
  const mostCommonOS = osEntries.length > 0
    ? osEntries.reduce((a, b) => (a[1] > b[1] ? a : b))[0]
    : 'N/A';

  // Calculate percentages
  const desktopPercentage = total > 0 ? ((deviceTypes.desktop / total) * 100).toFixed(1) : '0';
  const mobilePercentage = total > 0 ? ((deviceTypes.mobile / total) * 100).toFixed(1) : '0';
  const tabletPercentage = total > 0 ? ((deviceTypes.tablet / total) * 100).toFixed(1) : '0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        title="Total Participants"
        value={summary.totalParticipants.toLocaleString()}
        icon={Users}
        color="blue"
        description="All-time participant count"
      />

      <StatCard
        title="Most Common Device"
        value={mostCommonDevice.charAt(0).toUpperCase() + mostCommonDevice.slice(1)}
        icon={mostCommonDevice === 'desktop' ? Monitor : mostCommonDevice === 'mobile' ? Smartphone : Tablet}
        color="green"
        description={`${desktopPercentage}% Desktop, ${mobilePercentage}% Mobile, ${tabletPercentage}% Tablet`}
      />

      <StatCard
        title="Most Common Browser"
        value={mostCommonBrowser}
        icon={Globe}
        color="purple"
        description={`${summary.browsers[mostCommonBrowser]?.toLocaleString() || 0} participants`}
      />

      <StatCard
        title="Most Common OS"
        value={mostCommonOS}
        icon={Laptop}
        color="indigo"
        description={`${summary.operatingSystems[mostCommonOS]?.toLocaleString() || 0} participants`}
      />
    </div>
  );
}

