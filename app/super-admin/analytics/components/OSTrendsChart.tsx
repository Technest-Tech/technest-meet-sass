'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Card from '@/lib/components/Card';

interface OSTrendsChartProps {
  data: Array<Record<string, number>>;
}

const OS_COLORS: Record<string, string> = {
  Windows: '#0078d4',
  macOS: '#000000',
  Linux: '#fcc624',
  Android: '#3ddc84',
  iOS: '#000000',
};

export default function OSTrendsChart({ data }: OSTrendsChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Operating System Trends</h3>
        <div className="text-center py-12 text-gray-500">
          <p>No trend data available</p>
        </div>
      </Card>
    );
  }

  // Get all OS names from data
  const osNames = new Set<string>();
  data.forEach((item) => {
    Object.keys(item).forEach((key) => {
      if (key !== 'month') {
        osNames.add(key);
      }
    });
  });

  const sortedOS = Array.from(osNames).sort();

  return (
    <Card>
      <h3 className="text-lg font-bold text-gray-900 mb-4">Operating System Trends</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          {sortedOS.map((os, index) => (
            <Area
              key={os}
              type="monotone"
              dataKey={os}
              stackId="1"
              stroke={OS_COLORS[os] || `hsl(${index * 60}, 70%, 50%)`}
              fill={OS_COLORS[os] || `hsl(${index * 60}, 70%, 50%)`}
              fillOpacity={0.6}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

