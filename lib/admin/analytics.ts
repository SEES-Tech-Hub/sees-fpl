// The shape of admin_analytics() (supabase/migrations/*_analytics.sql).

export type AnalyticsDay = { day: string; views: number; visitors: number; signups: number; managers: number; events: number };

export type Analytics = {
  generatedAt: string;
  days: number;
  online: { now: number; signedIn: number; pages: { path: string; people: number }[] };
  totals: {
    users: number;
    officials: number;
    admins: number;
    managers: number;
    leagues: number;
    transfers: number;
    pushSubscribers: number;
    visitors: number;
    installed: number;
    pageViews: number;
    matchEvents: number;
    fixturesPlayed: number;
  };
  before: { users: number; managers: number };
  daily: AnalyticsDay[];
  hourly: { hour: number; views: number }[];
  topPages: { path: string; views: number; visitors: number }[];
  devices: { device: "phone" | "tablet" | "computer"; visitors: number }[];
  installed: { app: number; browser: number };
  referrers: { source: string; views: number }[];
  managersByYear: { year: number | null; managers: number }[];
  transfersByMatchday: { matchday: number; transfers: number }[];
  pushTopics: { kind: string; subscriptions: number }[];
  eventsBySport: { sport: string; events: number }[];
};

export const ANALYTICS_WINDOWS = [7, 30, 90] as const;
