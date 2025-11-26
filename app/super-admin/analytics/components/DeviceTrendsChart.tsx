'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Card from '@/lib/components/Card';

interface DeviceTrendsData {
  month: string;
  desktop: number;
  mobile: number;
  tablet: number;
  unknown: number;
}

interface DeviceTrendsChartProps {
  data: DeviceTrendsData[];
}

export default function DeviceTrendsChart({ data }: DeviceTrendsChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Device Type Trends</h3>
        <div className="text-center py-12 text-gray-500">
          <p>No trend data available</p>
        </div>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    month: item.month,
    Desktop: item.desktop,
    Mobile: item.mobile,
    Tablet: item.tablet,
    Unknown: item.unknown,
  }));

  return (
    <Card>
      <h3 className="text-lg font-bold text-gray-900 mb-4">Device Type Trends</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="Desktop" stroke="#3b82f6" strokeWidth={2} />
          <Line type="monotone" dataKey="Mobile" stroke="#10b981" strokeWidth={2} />
          <Line type="monotone" dataKey="Tablet" stroke="#8b5cf6" strokeWidth={2} />
          <Line type="monotone" dataKey="Unknown" stroke="#6b7280" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

