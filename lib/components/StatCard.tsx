'use client';

import { LucideIcon } from 'lucide-react';
import Card from './Card';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'blue' | 'green' | 'purple' | 'indigo' | 'orange' | 'red';
  description?: string;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  color = 'blue',
  description,
}: StatCardProps) {
  const colorClasses = {
    blue: {
      bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
      icon: 'text-blue-600',
      accent: 'bg-blue-500',
    },
    green: {
      bg: 'bg-gradient-to-br from-green-50 to-green-100',
      icon: 'text-green-600',
      accent: 'bg-green-500',
    },
    purple: {
      bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
      icon: 'text-purple-600',
      accent: 'bg-purple-500',
    },
    indigo: {
      bg: 'bg-gradient-to-br from-indigo-50 to-indigo-100',
      icon: 'text-indigo-600',
      accent: 'bg-indigo-500',
    },
    orange: {
      bg: 'bg-gradient-to-br from-orange-50 to-orange-100',
      icon: 'text-orange-600',
      accent: 'bg-orange-500',
    },
    red: {
      bg: 'bg-gradient-to-br from-red-50 to-red-100',
      icon: 'text-red-600',
      accent: 'bg-red-500',
    },
  };

  const colors = colorClasses[color];

  return (
    <Card hover className="relative overflow-hidden">
      {/* Decorative background shape */}
      <div className={`absolute -top-4 -right-4 w-24 h-24 ${colors.bg} rounded-full opacity-50 blur-2xl`} />
      <div className={`absolute -bottom-4 -left-4 w-32 h-32 ${colors.bg} rounded-full opacity-30 blur-3xl`} />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {description && (
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            )}
          </div>
          <div className={`p-3 rounded-xl ${colors.bg}`}>
            <Icon className={`w-6 h-6 ${colors.icon}`} />
          </div>
        </div>
        
        {trend && (
          <div className="flex items-center gap-1 mt-3">
            <span className={`text-sm font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-gray-500">من الشهر الماضي</span>
          </div>
        )}
      </div>
      
      {/* Bottom accent bar */}
      <div className={`absolute bottom-0 right-0 left-0 h-1 ${colors.accent}`} />
    </Card>
  );
}

