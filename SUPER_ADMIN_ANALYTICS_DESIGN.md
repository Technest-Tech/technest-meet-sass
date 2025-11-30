# Super Admin Analytics Dashboard — Layout & Components

## Experience Goals
- Give super admins a single glance at business health (revenue, active/trial subs, churn, referrals).
- Allow switching between date ranges (7/30/90 days) with instant recalculation of KPIs and charts.
- Surface actionable lists (top plans, at-risk subscriptions, referral leaders, recent activity) without leaving the dashboard.

## Page Structure (top → bottom)
1. **Hero Header**
   - Title/subtitle, user greeting, quick CTA to create account.
   - `RangeToggle` component (`'7d' | '30d' | '90d'`) pinned here.
2. **KPI Strip (responsive grid of `StatCard`s)**
   - Metrics: Total revenue (EGP), Active subscriptions, Trials in progress, Churn rate %, Referral conversions.
   - Each card shows absolute value + delta vs previous period (from API comparison block).
3. **Primary Analytics Row**
   - `RevenueTrendCard`: area/line chart (Recharts) using `metrics.revenue.series`.
   - `SubscriptionHealthCard`: stacked bar / mini chart showing `new`, `active`, `churned` counts over the range plus textual breakdown.
4. **Secondary Insights Row**
   - `PlanLeaderboardCard`: table listing top 5 plans by subscriber count with trend arrows.
   - `ReferralPipelineCard`: stats for referral events + pending payouts.
5. **Operations & Activity Row**
   - `AtRiskTable`: trials expiring soon or inactive accounts (from `subscriptions.atRisk` payload).
   - `RecentActivityFeed`: latest `RoomActivityLog` entries, with icon per event and status pill.

All sections support RTL and collapse to single-column on small screens.

## Component Tree (new or extended)
```
SuperAdminDashboardContent
 ├─ RangeToggle (new)
 ├─ StatCard (existing, add props for `trendLabel`)
 ├─ RevenueTrendCard (new; wraps Recharts `AreaChart`)
 ├─ SubscriptionHealthCard (new; stacked bars + legend)
 ├─ PlanLeaderboardCard (new; table with badge & mini sparkline)
 ├─ ReferralPipelineCard (new; list of KPIs)
 ├─ AtRiskTable (new; table with CTA buttons)
 └─ RecentActivityFeed (new; timeline layout)
```

## API Contract (to be returned by `/api/super-admin/metrics?range=7d`)
```ts
type MetricsRange = '7d' | '30d' | '90d';
interface SuperAdminMetricsResponse {
  range: MetricsRange;
  summary: {
    revenueEGP: number;
    activeSubscriptions: number;
    trials: number;
    churnRate: number;
    referralConversions: number;
  };
  comparison: {
    revenuePct: number;
    activePct: number;
    trialsPct: number;
    churnPct: number;
    referralsPct: number;
  };
  revenueSeries: { date: string; amountEGP: number }[];
  subscriptionSeries: { date: string; new: number; churned: number; trials: number }[];
  planLeaders: { planId: string; name: string; subscribers: number; deltaPct: number }[];
  referralLeaders: { clientId: string; name: string; points: number; conversions: number }[];
  atRiskSubscriptions: Array<{
    clientName: string;
    status: string;
    endsOn: string | null;
    reason: 'TRIAL_ENDING' | 'PAYMENT_DUE' | 'INACTIVE';
  }>;
  recentActivity: Array<{
    id: string;
    event: string;
    clientName: string;
    occurredAt: string;
    metadata?: Record<string, unknown>;
  }>;
}
```

## Visual Behavior & Interactions
- Range change triggers refetch via `?range=...`; show shimmer skeletons while loading.
- Charts include tooltips, accessible descriptions, and fall back text when no data.
- Cards/tables include CTA buttons (“View plan”, “Contact client”) routed to existing super-admin pages.
- All values formatted with `Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' })` or localized numerals.

## Data Sources
- Revenue/series from `BillingInvoice` (`status == PAID`, `paidAt` within range).
- Subscription/trial/churn metrics from `Subscription` (`createdAt`, `status`, `endDate`, `trialEndDate`).
- Referral conversions from `ReferralEvent` (`eventType == SUBSCRIBED`, `status == QUALIFIED`).
- Activity feed from `RoomActivityLog` (limit 8 recent events).
- At-risk detection uses `Subscription` combinations (trial ending in ≤7 days, inactive >10 days, expired).  





