'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Card from '@/lib/components/Card';

interface BrowserTrendsChartProps {
  data: Array<Record<string, number>>;
}

const BROWSER_COLORS: Record<string, string> = {
  Chrome: '#4285f4',
  Safari: '#000000',
  Firefox: '#ff7139',
  Edge: '#0078d4',
  Opera: '#ff1b2d',
};

export default function BrowserTrendsChart({ data }: BrowserTrendsChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Browser Trends</h3>
        <div className="text-center py-12 text-gray-500">
          <p>No trend data available</p>
        </div>
      </Card>
    );
  }

  // Get all browser names from data
  const browserNames = new Set<string>();
  data.forEach((item) => {
    Object.keys(item).forEach((key) => {
      if (key !== 'month') {
        browserNames.add(key);
      }
    });
  });

  const sortedBrowsers = Array.from(browserNames).sort();

  return (
    <Card>
      <h3 className="text-lg font-bold text-gray-900 mb-4">Browser Trends</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          {sortedBrowsers.map((browser, index) => (
            <Area
              key={browser}
              type="monotone"
              dataKey={browser}
              stackId="1"
              stroke={BROWSER_COLORS[browser] || `hsl(${index * 60}, 70%, 50%)`}
              fill={BROWSER_COLORS[browser] || `hsl(${index * 60}, 70%, 50%)`}
              fillOpacity={0.6}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

