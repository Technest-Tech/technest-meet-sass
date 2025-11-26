'use client';

import { useState, useEffect } from 'react';
import { Database, Server, Zap, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import Card from '@/lib/components/Card';

interface SystemStatus {
  database: { status: 'healthy' | 'warning' | 'error'; responseTime: number };
  livekit: { status: 'connected' | 'disconnected'; lastCheck: string };
  api: { avgResponseTime: number; errorRate: number };
  storage: { used: number; total: number; percentage: number };
}

export default function SystemStatusCard() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/super-admin/system-status', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch system status', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <div className="animate-pulse h-64 bg-gray-200 rounded" />
      </Card>
    );
  }

  if (!status) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error':
      case 'disconnected':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'healthy' || status === 'connected') {
      return <CheckCircle className="w-4 h-4" />;
    }
    return <AlertCircle className="w-4 h-4" />;
  };

  return (
    <Card>
      <h3 className="text-lg font-bold text-gray-900 mb-4">System Status</h3>
      <div className="space-y-3">
        <div className={`flex items-center justify-between p-4 rounded-xl border ${getStatusColor(status.database.status)}`}>
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5" />
            <div>
              <span className="font-medium">Database</span>
              <p className="text-xs opacity-75">{status.database.responseTime}ms response time</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(status.database.status)}
            <span className="text-sm font-medium capitalize">{status.database.status}</span>
          </div>
        </div>

        <div className={`flex items-center justify-between p-4 rounded-xl border ${getStatusColor(status.livekit.status)}`}>
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5" />
            <div>
              <span className="font-medium">LiveKit Server</span>
              <p className="text-xs opacity-75">
                Last checked: {new Date(status.livekit.lastCheck).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(status.livekit.status)}
            <span className="text-sm font-medium capitalize">{status.livekit.status}</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl border border-blue-200 bg-blue-50">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-blue-600" />
            <div>
              <span className="font-medium text-blue-900">API Performance</span>
              <p className="text-xs text-blue-700">
                Avg: {status.api.avgResponseTime}ms • Error rate: {status.api.errorRate.toFixed(2)}%
              </p>
            </div>
          </div>
          <Clock className="w-4 h-4 text-blue-600" />
        </div>

        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-900">Storage Usage</span>
            <span className="text-sm font-semibold text-gray-700">{status.storage.percentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                status.storage.percentage > 80
                  ? 'bg-red-500'
                  : status.storage.percentage > 60
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${status.storage.percentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {formatBytes(status.storage.used)} / {formatBytes(status.storage.total)}
          </p>
        </div>
      </div>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

