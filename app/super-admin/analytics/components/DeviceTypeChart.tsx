'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import Card from '@/lib/components/Card';

interface DeviceTypeData {
  desktop: number;
  mobile: number;
  tablet: number;
  unknown: number;
}

interface DeviceTypeChartProps {
  data: DeviceTypeData;
}

const COLORS = {
  desktop: '#3b82f6',
  mobile: '#10b981',
  tablet: '#8b5cf6',
  unknown: '#6b7280',
};

export default function DeviceTypeChart({ data }: DeviceTypeChartProps) {
  const total = data.desktop + data.mobile + data.tablet + data.unknown;

  if (total === 0) {
    return (
      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Device Types</h3>
        <div className="text-center py-12 text-gray-500">
          <p>No data available</p>
        </div>
      </Card>
    );
  }

  const chartData = [
    { name: 'Desktop', value: data.desktop, percentage: ((data.desktop / total) * 100).toFixed(1) },
    { name: 'Mobile', value: data.mobile, percentage: ((data.mobile / total) * 100).toFixed(1) },
    { name: 'Tablet', value: data.tablet, percentage: ((data.tablet / total) * 100).toFixed(1) },
    { name: 'Unknown', value: data.unknown, percentage: ((data.unknown / total) * 100).toFixed(1) },
  ].filter((item) => item.value > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold">{payload[0].name}</p>
          <p className="text-sm text-gray-600">
            {payload[0].value} participants ({payload[0].payload.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <h3 className="text-lg font-bold text-gray-900 mb-4">Device Types</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percentage }) => `${name}: ${percentage}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.name.toLowerCase() as keyof typeof COLORS] || COLORS.unknown} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}

