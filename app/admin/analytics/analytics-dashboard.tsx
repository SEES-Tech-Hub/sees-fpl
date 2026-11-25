"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Bell, Download, Eye, Radio, Smartphone, Trophy, Users, UserRoundPlus } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loadAnalytics } from "@/lib/admin/actions/analytics";
import { ANALYTICS_WINDOWS, type Analytics } from "@/lib/admin/analytics";
import { cn } from "@/lib/utils";

// Admin → Analytics. Tabs: Overview (online now, refreshed every 30 s, and
// the headline numbers), Traffic, Users, Fantasy and Live. Charts use the
// brand chart colours (--chart-1 … --chart-5 in globals.css).

const REFRESH_MS = 30_000;

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const num = (n: number) => new Intl.NumberFormat("en-GB").format(n);

export function AnalyticsDashboard({ initial }: { initial: Analytics }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState("overview");

  // Keep "online now" fresh while the page is open and visible.
  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const r = await loadAnalytics(data.days).catch(() => null);
      if (r?.ok) setData(r.data);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [data.days]);

  const t = data.totals;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <OnlineBadge now={data.online.now} signedIn={data.online.signedIn} />
        <div className="flex rounded-lg bg-muted p-1" role="group" aria-label="Time window">
          {ANALYTICS_WINDOWS.map((d) => (
            <Link
              key={d}
              href={`/admin/analytics?days=${d}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                d === data.days ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d} days
            </Link>
          ))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-10 w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="traffic">Traffic</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="fantasy">Fantasy</TabsTrigger>
          <TabsTrigger value="live">Live</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={<Users />} label="Users" value={t.users} sub={`${t.officials} officials · ${t.admins} admins`} />
            <Stat icon={<Trophy />} label="Fantasy managers" value={t.managers} sub={`${t.leagues} leagues`} />
            <Stat icon={<Eye />} label="Visitors" value={t.visitors} sub={`${num(t.pageViews)} page views`} />
            <Stat icon={<Bell />} label="Push subscribers" value={t.pushSubscribers} sub={`${t.installed} installed the app`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            <Panel title="Visitors per day" description={`Last ${data.days} days`}>
              <DailyArea data={data.daily} keyName="visitors" label="Visitors" color="var(--chart-2)" />
            </Panel>
            <Panel title="Online now" description="By page, in the last 2 minutes">
              {data.online.pages.length === 0 ? (
                <Empty>Nobody&apos;s on the app right now.</Empty>
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.online.pages.map((p) => (
                    <li key={p.path} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">{p.path}</span>
                      <span className="font-heading text-base font-bold tabular-nums">{p.people}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="traffic" className="mt-4 flex flex-col gap-4">
          <Panel title="Page views and visitors" description={`Per day, last ${data.days} days (WAT)`}>
            <DailyBars data={data.daily} />
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Busiest hours" description="Page views in the last 24 hours, by hour (WAT)">
              <HourBars data={data.hourly} />
            </Panel>
            <Panel title="Top pages" description={`Last ${data.days} days`}>
              <RankList rows={data.topPages.map((p) => ({ label: p.path, value: p.views, sub: `${num(p.visitors)} visitors` }))} mono />
            </Panel>
            <Panel title="Devices" description="Visitors in this window">
              <Donut
                rows={data.devices.map((d) => ({ name: d.device === "phone" ? "Phone" : d.device === "tablet" ? "Tablet" : "Computer", value: d.visitors }))}
              />
            </Panel>
            <Panel title="Installed app or browser" description="Visitors in this window">
              <Donut rows={[{ name: "Installed app", value: data.installed.app }, { name: "Browser", value: data.installed.browser }]} />
            </Panel>
            <Panel title="Where visitors came from" description="Links from other sites (shares, search)">
              {data.referrers.length === 0 ? (
                <Empty>No outside links yet. Shares from WhatsApp show up here.</Empty>
              ) : (
                <RankList rows={data.referrers.map((r) => ({ label: r.source, value: r.views }))} />
              )}
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={<Users />} label="Users" value={t.users} />
            <Stat icon={<UserRoundPlus />} label="New in window" value={data.daily.reduce((s, d) => s + d.signups, 0)} sub={`last ${data.days} days`} />
            <Stat icon={<Radio />} label="Officials" value={t.officials} />
            <Stat icon={<Smartphone />} label="Installed the app" value={t.installed} />
          </div>
          <Panel title="Users over time" description="Everyone who has signed in, by day">
            <Cumulative data={data.daily} keyName="signups" start={data.before.users} label="Users" color="var(--chart-1)" />
          </Panel>
          <Panel title="New sign-ups per day" description={`Last ${data.days} days`}>
            <DailyArea data={data.daily} keyName="signups" label="Sign-ups" color="var(--chart-4)" />
          </Panel>
        </TabsContent>

        <TabsContent value="fantasy" className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={<Trophy />} label="Managers" value={t.managers} />
            <Stat icon={<Users />} label="Leagues" value={t.leagues} />
            <Stat icon={<Download />} label="Transfers" value={t.transfers} />
            <Stat icon={<UserRoundPlus />} label="New teams in window" value={data.daily.reduce((s, d) => s + d.managers, 0)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Managers over time" description="Fantasy teams created, by day">
              <Cumulative data={data.daily} keyName="managers" start={data.before.managers} label="Managers" color="var(--chart-2)" />
            </Panel>
            <Panel title="Managers by year" description="The year each manager picked">
              <SimpleBars
                rows={data.managersByYear.map((m) => ({ name: m.year ? `Year ${m.year}` : "No year", value: m.managers }))}
                label="Managers"
              />
            </Panel>
            <Panel title="Transfers per matchday">
              {data.transfersByMatchday.length === 0 ? (
                <Empty>No transfers yet.</Empty>
              ) : (
                <SimpleBars rows={data.transfersByMatchday.map((m) => ({ name: `MD${m.matchday}`, value: m.transfers }))} label="Transfers" />
              )}
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="live" className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={<Radio />} label="Match events" value={t.matchEvents} sub="recorded by officials" />
            <Stat icon={<Trophy />} label="Matches finished" value={t.fixturesPlayed} />
            <Stat icon={<Bell />} label="Push subscribers" value={t.pushSubscribers} />
            <Stat icon={<Eye />} label="Online now" value={data.online.now} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Events recorded per day" description={`Last ${data.days} days`}>
              <DailyArea data={data.daily} keyName="events" label="Events" color="var(--chart-5)" />
            </Panel>
            <Panel title="Events by sport">
              {data.eventsBySport.length === 0 ? (
                <Empty>No events recorded yet.</Empty>
              ) : (
                <RankList rows={data.eventsBySport.map((s) => ({ label: s.sport, value: s.events }))} />
              )}
            </Panel>
            <Panel title="What people follow" description="Notification subscriptions by kind">
              {data.pushTopics.length === 0 ? (
                <Empty>Nobody has turned on notifications yet.</Empty>
              ) : (
                <Donut
                  rows={data.pushTopics.map((p) => ({
                    name: p.kind === "all" ? "All matches" : p.kind === "fixture" ? "A match" : p.kind === "team" ? "A year team" : p.kind,
                    value: p.subscriptions,
                  }))}
                />
              )}
            </Panel>
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Updated {new Intl.DateTimeFormat("en-GB", { timeStyle: "medium", timeZone: "Africa/Lagos" }).format(new Date(data.generatedAt))} WAT ·
        refreshes every 30 seconds
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function OnlineBadge({ now, signedIn }: { now: number; signedIn: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-pitch px-4 py-2.5 text-brand-foreground shadow-card">
      <span className="relative flex size-3">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-light opacity-75" />
        <span className="relative inline-flex size-3 rounded-full bg-brand-light" />
      </span>
      <span className="font-heading text-2xl leading-none font-bold tabular-nums">{num(now)}</span>
      <span className="text-sm leading-tight">
        online now
        <span className="block text-xs text-brand-foreground/75">{num(signedIn)} signed in</span>
      </span>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: ReactNode; label: string; value: number; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-card p-4 shadow-card">
      <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase [&_svg]:size-4 [&_svg]:text-brand">
        {icon}
        {label}
      </span>
      <span className="font-heading text-3xl leading-none font-bold tabular-nums">{num(value)}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card">
      <div>
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-muted px-3 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

type DailyKey = "views" | "visitors" | "signups" | "managers" | "events";

function DailyArea({ data, keyName, label, color }: { data: Analytics["daily"]; keyName: DailyKey; label: string; color: string }) {
  const config = { [keyName]: { label, color } } satisfies ChartConfig;
  const rows = data.map((d) => ({ day: dayLabel(d.day), [keyName]: d[keyName] }));
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <AreaChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
        <defs>
          <linearGradient id={`fill-${keyName}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={`var(--color-${keyName})`} stopOpacity={0.5} />
            <stop offset="95%" stopColor={`var(--color-${keyName})`} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area dataKey={keyName} type="monotone" stroke={`var(--color-${keyName})`} strokeWidth={2} fill={`url(#fill-${keyName})`} />
      </AreaChart>
    </ChartContainer>
  );
}

function Cumulative({
  data,
  keyName,
  start,
  label,
  color,
}: {
  data: Analytics["daily"];
  keyName: "signups" | "managers";
  start: number;
  label: string;
  color: string;
}) {
  const rows = useMemo(
    () =>
      data.map((d, i) => ({
        day: dayLabel(d.day),
        total: start + data.slice(0, i + 1).reduce((sum, x) => sum + x[keyName], 0),
      })),
    [data, keyName, start],
  );
  const config = { total: { label, color } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <AreaChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
        <defs>
          <linearGradient id={`fill-total-${keyName}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.45} />
            <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area dataKey="total" type="stepAfter" stroke="var(--color-total)" strokeWidth={2} fill={`url(#fill-total-${keyName})`} />
      </AreaChart>
    </ChartContainer>
  );
}

function DailyBars({ data }: { data: Analytics["daily"] }) {
  const config = {
    views: { label: "Page views", color: "var(--chart-2)" },
    visitors: { label: "Visitors", color: "var(--chart-1)" },
  } satisfies ChartConfig;
  const rows = data.map((d) => ({ day: dayLabel(d.day), views: d.views, visitors: d.visitors }));
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={20} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="views" fill="var(--color-views)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="visitors" fill="var(--color-visitors)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function HourBars({ data }: { data: Analytics["hourly"] }) {
  const config = { views: { label: "Page views", color: "var(--chart-2)" } } satisfies ChartConfig;
  const rows = data.map((h) => ({ hour: `${String(h.hour).padStart(2, "0")}:00`, views: h.views }));
  return (
    <ChartContainer config={config} className="aspect-auto h-52 w-full">
      <BarChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="hour" tickLine={false} axisLine={false} interval={3} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="views" fill="var(--color-views)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function SimpleBars({ rows, label }: { rows: { name: string; value: number }[]; label: string }) {
  const config = { value: { label, color: "var(--chart-2)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-52 w-full">
      <BarChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

const DONUT = ["var(--chart-1)", "var(--chart-3)", "var(--chart-4)", "var(--chart-2)", "var(--chart-5)"];

function Donut({ rows }: { rows: { name: string; value: number }[] }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (total === 0) return <Empty>No data in this window yet.</Empty>;
  const config = Object.fromEntries(rows.map((r, i) => [r.name, { label: r.name, color: DONUT[i % DONUT.length] }])) satisfies ChartConfig;
  return (
    <div className="flex items-center gap-4">
      <ChartContainer config={config} className="aspect-square h-40 shrink-0">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} strokeWidth={2}>
            {rows.map((r, i) => (
              <Cell key={r.name} fill={DONUT[i % DONUT.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="flex flex-1 flex-col gap-2 text-sm">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="size-3 rounded-sm" style={{ background: DONUT[i % DONUT.length] }} aria-hidden />
            <span className="flex-1">{r.name}</span>
            <span className="font-semibold tabular-nums">{num(r.value)}</span>
            <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{Math.round((r.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RankList({ rows, mono = false }: { rows: { label: string; value: number; sub?: string }[]; mono?: boolean }) {
  if (rows.length === 0) return <Empty>No data in this window yet.</Empty>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.label} className="relative overflow-hidden rounded-md px-2 py-1.5">
          <span aria-hidden className="absolute inset-y-0 left-0 rounded-md bg-secondary" style={{ width: `${(r.value / max) * 100}%` }} />
          <span className="relative flex items-center gap-2 text-sm">
            <span className={cn("min-w-0 flex-1 truncate", mono && "font-mono text-xs")}>{r.label}</span>
            {r.sub && <span className="text-xs text-muted-foreground">{r.sub}</span>}
            <span className="font-semibold tabular-nums">{num(r.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
