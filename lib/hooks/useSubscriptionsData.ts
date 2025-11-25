import { useCallback, useEffect, useMemo, useState } from 'react';

export interface SubscriptionPlanFeature {
  feature: string;
  enabled: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string | null;
  features: SubscriptionPlanFeature[];
}

export interface SubscriptionSource {
  id: string;
  label: string;
  description?: string | null;
  isActive: boolean;
}

export interface SubscriptionClientRoomStats {
  totalRooms: number;
  activeRooms: number;
  avgRoomCapacity: number;
  activeNow: number;
  capacityUtilization: number;
}

export interface SubscriptionClient {
  id: string;
  name: string;
  email: string;
  maxRooms: number;
  maxParticipants: number;
  whatsappNumber?: string | null;
  roomStats: SubscriptionClientRoomStats;
}

export interface SubscriptionMetrics {
  trialDaysRemaining: number | null;
  trialProgress: number | null;
  hasTrialEnded: boolean;
  isExpiringSoon: boolean;
  lastRoomCreatedAt: string | null;
}

export interface SubscriptionRecord {
  id: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  amountEGP?: number | null;
  isTrial?: boolean;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  trialDays?: number | null;
  createdAt: string;
  updatedAt: string;
  plan: SubscriptionPlan;
  client: SubscriptionClient;
  metrics?: SubscriptionMetrics;
  source?: SubscriptionSource | null;
}

export interface SubscriptionsOverview {
  total: number;
  active: number;
  trials: number;
  expiringTrials: number;
  renewalsDue: number;
  atRisk: number;
}

interface ApiResponse {
  subscriptions: SubscriptionRecord[];
  overview: SubscriptionsOverview;
  planDistribution: Record<string, number>;
}

const defaultOverview: SubscriptionsOverview = {
  total: 0,
  active: 0,
  trials: 0,
  expiringTrials: 0,
  renewalsDue: 0,
  atRisk: 0,
};

export function useSubscriptionsData(pollInterval = 60_000) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/super-admin/subscriptions', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions data');
      }

      const payload: ApiResponse = await response.json();
      setData(payload);
    } catch (err) {
      console.error('Subscriptions fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!pollInterval) return;

    const interval = setInterval(() => {
      fetchData();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [fetchData, pollInterval]);

  const planDistribution = useMemo(() => {
    if (!data?.planDistribution) return [];

    const total = Object.values(data.planDistribution).reduce((sum, value) => sum + value, 0);
    return Object.entries(data.planDistribution).map(([plan, value]) => ({
      plan,
      value,
      percentage: total ? Math.round((value / total) * 100) : 0,
    }));
  }, [data]);

  return {
    subscriptions: data?.subscriptions ?? [],
    overview: data?.overview ?? defaultOverview,
    planDistribution,
    isLoading,
    error,
    refetch: fetchData,
  };
}

