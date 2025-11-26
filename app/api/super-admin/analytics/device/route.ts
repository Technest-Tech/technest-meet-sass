import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { ActivityEventType } from '@prisma/client';

interface DeviceInfo {
  deviceType?: string;
  browser?: string;
  os?: string;
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    // Get all PARTICIPANT_JOINED events
    const participantLogs = await prisma.roomActivityLog.findMany({
      where: {
        event: ActivityEventType.PARTICIPANT_JOINED,
      },
      select: {
        metadata: true,
        occurredAt: true,
      },
      orderBy: {
        occurredAt: 'asc',
      },
    });

    // Aggregate summary data
    const deviceTypes: Record<string, number> = {};
    const browsers: Record<string, number> = {};
    const operatingSystems: Record<string, number> = {};
    let totalParticipants = 0;

    // Process each log entry
    participantLogs.forEach((log) => {
      if (!log.metadata || typeof log.metadata !== 'object') return;

      const metadata = log.metadata as Record<string, unknown>;
      const device = metadata.device as DeviceInfo | undefined;

      if (!device) return;

      totalParticipants++;

      // Count device types
      const deviceType = device.deviceType || 'unknown';
      deviceTypes[deviceType] = (deviceTypes[deviceType] || 0) + 1;

      // Count browsers
      const browser = device.browser || 'Unknown';
      browsers[browser] = (browsers[browser] || 0) + 1;

      // Count operating systems
      const os = device.os || 'Unknown';
      operatingSystems[os] = (operatingSystems[os] || 0) + 1;
    });

    // Calculate trends (group by month)
    const trends = calculateTrends(participantLogs);

    return NextResponse.json({
      summary: {
        deviceTypes: {
          desktop: deviceTypes.desktop || 0,
          mobile: deviceTypes.mobile || 0,
          tablet: deviceTypes.tablet || 0,
          unknown: deviceTypes.unknown || 0,
        },
        browsers,
        operatingSystems,
        totalParticipants,
      },
      trends,
    });
  } catch (error) {
    console.error('Device analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch device analytics' }, { status: 500 });
  }
}

function calculateTrends(logs: Array<{ metadata: unknown; occurredAt: Date }>) {
  // Group by month
  const monthlyData: Record<
    string,
    {
      deviceTypes: Record<string, number>;
      browsers: Record<string, number>;
      operatingSystems: Record<string, number>;
    }
  > = {};

  logs.forEach((log) => {
    if (!log.metadata || typeof log.metadata !== 'object') return;

    const metadata = log.metadata as Record<string, unknown>;
    const device = metadata.device as DeviceInfo | undefined;

    if (!device) return;

    const date = new Date(log.occurredAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        deviceTypes: {},
        browsers: {},
        operatingSystems: {},
      };
    }

    const month = monthlyData[monthKey];

    // Device types
    const deviceType = device.deviceType || 'unknown';
    month.deviceTypes[deviceType] = (month.deviceTypes[deviceType] || 0) + 1;

    // Browsers
    const browser = device.browser || 'Unknown';
    month.browsers[browser] = (month.browsers[browser] || 0) + 1;

    // Operating systems
    const os = device.os || 'Unknown';
    month.operatingSystems[os] = (month.operatingSystems[os] || 0) + 1;
  });

  // Convert to arrays sorted by month
  const sortedMonths = Object.keys(monthlyData).sort();

  const deviceTypeTrends = sortedMonths.map((month) => {
    const data = monthlyData[month];
    return {
      month,
      desktop: data.deviceTypes.desktop || 0,
      mobile: data.deviceTypes.mobile || 0,
      tablet: data.deviceTypes.tablet || 0,
      unknown: data.deviceTypes.unknown || 0,
    };
  });

  // Get top browsers and OS for trends
  const allBrowsers = new Set<string>();
  const allOS = new Set<string>();

  Object.values(monthlyData).forEach((month) => {
    Object.keys(month.browsers).forEach((b) => allBrowsers.add(b));
    Object.keys(month.operatingSystems).forEach((os) => allOS.add(os));
  });

  // Get top 5 browsers and OS by total count
  const browserCounts: Record<string, number> = {};
  const osCounts: Record<string, number> = {};

  Object.values(monthlyData).forEach((month) => {
    Object.entries(month.browsers).forEach(([browser, count]) => {
      browserCounts[browser] = (browserCounts[browser] || 0) + count;
    });
    Object.entries(month.operatingSystems).forEach(([os, count]) => {
      osCounts[os] = (osCounts[os] || 0) + count;
    });
  });

  const topBrowsers = Object.entries(browserCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name]) => name);

  const topOS = Object.entries(osCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name]) => name);

  const browserTrends = sortedMonths.map((month) => {
    const data = monthlyData[month];
    const result: Record<string, number> = { month };
    topBrowsers.forEach((browser) => {
      result[browser] = data.browsers[browser] || 0;
    });
    return result;
  });

  const osTrends = sortedMonths.map((month) => {
    const data = monthlyData[month];
    const result: Record<string, number> = { month };
    topOS.forEach((os) => {
      result[os] = data.operatingSystems[os] || 0;
    });
    return result;
  });

  return {
    deviceTypes: deviceTypeTrends,
    browsers: browserTrends,
    operatingSystems: osTrends,
  };
}

