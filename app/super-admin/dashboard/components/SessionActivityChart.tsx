'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SessionActivityData {
  time: string;
  hour: number;
  started: number;
  ended: number;
  active: number;
}

interface SessionActivityChartProps {
  data: SessionActivityData[];
}

export default function SessionActivityChart({ data }: SessionActivityChartProps) {
  const chartData = data.map((d) => ({
    hour: `${d.hour}:00`,
    started: d.started,
    ended: d.ended,
    active: d.active,
  }));

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Session Activity (Last 24 Hours)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="hour" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Area
            type="monotone"
            dataKey="active"
            stackId="1"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.6}
            name="Active Sessions"
          />
          <Area
            type="monotone"
            dataKey="started"
            stackId="2"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.4}
            name="Started"
          />
          <Area
            type="monotone"
            dataKey="ended"
            stackId="2"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.4}
            name="Ended"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

