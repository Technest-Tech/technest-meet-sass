'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, Info, X, ChevronDown, ChevronUp } from 'lucide-react';
import Card from '@/lib/components/Card';

type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

interface Alert {
  type: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/super-admin/alerts', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch alerts', error);
    } finally {
      setIsLoading(false);
    }
  };

  const dismissAlert = (alertId: string) => {
    setDismissedAlerts((prev) => new Set([...prev, alertId]));
  };

  const visibleAlerts = alerts.filter(
    (alert) => !dismissedAlerts.has(`${alert.type}-${alert.timestamp}`)
  );

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'error':
        return 'bg-orange-50 border-orange-200 text-orange-900';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'info':
        return <Info className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getSeverityBadgeColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'error':
        return 'bg-orange-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'info':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const criticalCount = visibleAlerts.filter((a) => a.severity === 'critical').length;
  const errorCount = visibleAlerts.filter((a) => a.severity === 'error').length;
  const warningCount = visibleAlerts.filter((a) => a.severity === 'warning').length;
  const infoCount = visibleAlerts.filter((a) => a.severity === 'info').length;

  const displayedAlerts = isExpanded ? visibleAlerts : visibleAlerts.slice(0, 3);

  if (isLoading) {
    return (
      <Card>
        <div className="animate-pulse h-32 bg-gray-200 rounded" />
      </Card>
    );
  }

  if (visibleAlerts.length === 0) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Alerts & Notifications</h3>
          <span className="text-sm text-gray-500">All systems operational</span>
        </div>
        <div className="text-center py-8 text-gray-500">
          <Info className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>No active alerts</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-gray-900">Alerts & Notifications</h3>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <span className={`px-2 py-1 rounded-full text-xs font-semibold text-white ${getSeverityBadgeColor('critical')}`}>
                {criticalCount}
              </span>
            )}
            {errorCount > 0 && (
              <span className={`px-2 py-1 rounded-full text-xs font-semibold text-white ${getSeverityBadgeColor('error')}`}>
                {errorCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className={`px-2 py-1 rounded-full text-xs font-semibold text-white ${getSeverityBadgeColor('warning')}`}>
                {warningCount}
              </span>
            )}
            {infoCount > 0 && (
              <span className={`px-2 py-1 rounded-full text-xs font-semibold text-white ${getSeverityBadgeColor('info')}`}>
                {infoCount}
              </span>
            )}
          </div>
        </div>
        {visibleAlerts.length > 3 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                View All ({visibleAlerts.length})
              </>
            )}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {displayedAlerts.map((alert, index) => {
          const alertId = `${alert.type}-${alert.timestamp}`;
          return (
            <div
              key={alertId}
              className={`flex items-start gap-3 p-4 rounded-xl border ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex-shrink-0 mt-0.5">{getSeverityIcon(alert.severity)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">{alert.title}</h4>
                    <p className="text-sm opacity-90">{alert.description}</p>
                    <p className="text-xs opacity-75 mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => dismissAlert(alertId)}
                    className="flex-shrink-0 p-1 hover:bg-black/10 rounded transition-colors"
                    aria-label="Dismiss alert"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

