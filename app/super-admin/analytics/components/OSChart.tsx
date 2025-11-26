'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Card from '@/lib/components/Card';

interface OSChartProps {
  data: Record<string, number>;
}

export default function OSChart({ data }: OSChartProps) {
  const total = Object.values(data).reduce((sum, count) => sum + count, 0);

  if (total === 0) {
    return (
      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Operating Systems</h3>
        <div className="text-center py-12 text-gray-500">
          <p>No data available</p>
        </div>
      </Card>
    );
  }

  // Sort by count and take top 10, group others
  const sortedEntries = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  const otherCount = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(10)
    .reduce((sum, [, count]) => sum + count, 0);

  const chartData = sortedEntries.map(([name, count]) => ({
    name,
    count,
    percentage: ((count / total) * 100).toFixed(1),
  }));

  if (otherCount > 0) {
    chartData.push({
      name: 'Other',
      count: otherCount,
      percentage: ((otherCount / total) * 100).toFixed(1),
    });
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold">{payload[0].payload.name}</p>
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
      <h3 className="text-lg font-bold text-gray-900 mb-4">Operating Systems</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="name" type="category" width={70} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" fill="#8b5cf6" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

