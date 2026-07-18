import { prisma } from "@/src/db/client";
import { getSetting } from "@/src/domains/settings/service";

export type CronStatsRange = "today" | "week" | "month" | "year";

export type CronSeriesPoint = {
  date: string;
  invoicesCreated: number;
  servicesSuspended: number;
  servicesTerminated: number;
  invoicesCharged: number;
};

export type CronTodayStats = {
  invoicesCreated: number;
  servicesSuspended: number;
  servicesTerminated: number;
  ticketsClosed: number;
  invoicesCharged: number;
};

function startOfUtcDay(d: Date) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function addUtcDays(d: Date, days: number) {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatMonthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}

function rangeBounds(range: CronStatsRange, now = new Date()) {
  const todayStart = startOfUtcDay(now);
  if (range === "today") {
    return { from: todayStart, to: addUtcDays(todayStart, 1), bucket: "day" as const };
  }
  if (range === "week") {
    return {
      from: addUtcDays(todayStart, -6),
      to: addUtcDays(todayStart, 1),
      bucket: "day" as const,
    };
  }
  if (range === "month") {
    return {
      from: addUtcDays(todayStart, -29),
      to: addUtcDays(todayStart, 1),
      bucket: "day" as const,
    };
  }
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return {
    from: yearStart,
    to: addUtcDays(todayStart, 1),
    bucket: "month" as const,
  };
}

function emptyMetrics() {
  return {
    invoicesCreated: 0,
    servicesSuspended: 0,
    servicesTerminated: 0,
    ticketsClosed: 0,
    invoicesCharged: 0,
  };
}

/** Next wall-clock occurrence of `HH:MM` in the given IANA timezone. */
export function computeNextCronRun(
  cronTime: string,
  timezone: string,
  now = new Date(),
): Date {
  const [hourRaw, minuteRaw] = cronTime.split(":");
  const hour = Number(hourRaw) || 0;
  const minute = Number(minuteRaw) || 0;

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  function partsInTz(date: Date) {
    const parts = dtf.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);
    return {
      year: get("year"),
      month: get("month"),
      day: get("day"),
      hour: get("hour"),
      minute: get("minute"),
      second: get("second"),
    };
  }

  // Binary-search-ish: walk forward in 1-minute steps up to 48h to find next match.
  // Efficient enough for admin stats.
  let cursor = new Date(now.getTime());
  cursor.setUTCSeconds(0, 0);
  for (let i = 0; i < 60 * 48; i++) {
    const p = partsInTz(cursor);
    if (p.hour === hour && p.minute === minute) {
      if (cursor.getTime() > now.getTime()) return cursor;
    }
    cursor = new Date(cursor.getTime() + 60_000);
  }

  // Fallback: tomorrow same UTC time
  const fallback = new Date(now);
  fallback.setUTCHours(hour, minute, 0, 0);
  if (fallback <= now) fallback.setUTCDate(fallback.getUTCDate() + 1);
  return fallback;
}

export async function getCronStats(range: CronStatsRange = "week") {
  const now = new Date();
  const { from, to, bucket } = rangeBounds(range, now);
  const todayStart = startOfUtcDay(now);
  const tomorrow = addUtcDays(todayStart, 1);

  const [cronTime, timezone, lastSweep, lastDaily, rangeRuns, todayRuns] =
    await Promise.all([
      getSetting("cron.time", "00:00").then(String),
      getSetting("app.timezone", "UTC").then(String),
      prisma.cronRun.findFirst({
        where: { kind: "SWEEP", status: "SUCCESS" },
        orderBy: { finishedAt: "desc" },
      }),
      prisma.cronRun.findFirst({
        where: { kind: "DAILY", status: "SUCCESS" },
        orderBy: { finishedAt: "desc" },
      }),
      prisma.cronRun.findMany({
        where: {
          finishedAt: { gte: from, lt: to },
          status: "SUCCESS",
        },
        orderBy: { finishedAt: "asc" },
      }),
      prisma.cronRun.findMany({
        where: {
          finishedAt: { gte: todayStart, lt: tomorrow },
          status: "SUCCESS",
        },
      }),
    ]);

  const buckets = new Map<
    string,
    {
      invoicesCreated: number;
      servicesSuspended: number;
      servicesTerminated: number;
      invoicesCharged: number;
    }
  >();

  function ensureBucket(key: string) {
    if (!buckets.has(key)) {
      buckets.set(key, {
        invoicesCreated: 0,
        servicesSuspended: 0,
        servicesTerminated: 0,
        invoicesCharged: 0,
      });
    }
    return buckets.get(key)!;
  }

  // Seed empty buckets so the chart has continuous axis
  if (bucket === "day") {
    for (let d = new Date(from); d < to; d = addUtcDays(d, 1)) {
      ensureBucket(formatDayKey(d));
    }
  } else {
    let cursor = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1),
    );
    while (cursor < to) {
      ensureBucket(formatMonthKey(cursor));
      cursor = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
      );
    }
  }

  for (const run of rangeRuns) {
    const key =
      bucket === "day"
        ? formatDayKey(run.finishedAt)
        : formatMonthKey(run.finishedAt);
    const b = ensureBucket(key);
    b.invoicesCreated += run.invoicesCreated;
    b.servicesSuspended += run.servicesSuspended;
    b.servicesTerminated += run.servicesTerminated;
    b.invoicesCharged += run.invoicesCharged;
  }

  const series: CronSeriesPoint[] = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }));

  const today = todayRuns.reduce<CronTodayStats>((acc, run) => {
    acc.invoicesCreated += run.invoicesCreated;
    acc.servicesSuspended += run.servicesSuspended;
    acc.servicesTerminated += run.servicesTerminated;
    acc.ticketsClosed += run.ticketsClosed;
    acc.invoicesCharged += run.invoicesCharged;
    return acc;
  }, emptyMetrics());

  return {
    lastSchedulerRun: lastSweep?.finishedAt.toISOString() ?? null,
    lastCronRun: lastDaily?.finishedAt.toISOString() ?? null,
    nextCronRun: computeNextCronRun(cronTime, timezone, now).toISOString(),
    cronTime,
    timezone,
    range,
    series,
    today,
  };
}
