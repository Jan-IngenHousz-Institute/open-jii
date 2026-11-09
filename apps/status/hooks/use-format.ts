"use client";

import { useTranslation } from "@repo/i18n/client";

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

const cache = new Map<string, ReturnType<typeof createFormatters>>();

function createFormatters(language: string) {
  return {
    date: new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "UTC" }),
    weekdayDate: new Intl.DateTimeFormat(language, { dateStyle: "full", timeZone: "UTC" }),
    shortDate: new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" }),
    monthDay: new Intl.DateTimeFormat(language, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
    time: new Intl.DateTimeFormat(language, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "UTC",
    }),
    dateTime: new Intl.DateTimeFormat(language, {
      dateStyle: "medium",
      timeStyle: "short",
      hourCycle: "h23",
      timeZone: "UTC",
    }),
    names: new Intl.ListFormat(language, { style: "long", type: "conjunction" }),
    clauses: new Intl.ListFormat(language, { style: "long", type: "unit" }),
    uptime: new Intl.NumberFormat(language, {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    fullUptime: new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 0 }),
  };
}

// One set per language, because every history bar formats its own label.
function formattersFor(language: string) {
  const cached = cache.get(language);
  if (cached !== undefined) {
    return cached;
  }

  const created = createFormatters(language);
  cache.set(language, created);

  return created;
}

// The page language sets the wording and number style; dates are always UTC so a time means the
// same thing to everyone.
export function useFormat() {
  const { t, i18n } = useTranslation("status");
  const formats = formattersFor(i18n.language);

  function duration(minutes: number) {
    const days = Math.floor(minutes / MINUTES_PER_DAY);
    const hours = Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
    const rest = minutes % MINUTES_PER_HOUR;

    if (days > 0) {
      return hours === 0 ? t("duration.days", { days }) : t("duration.daysHours", { days, hours });
    }

    if (hours === 0) {
      return t("duration.minutes", { minutes: rest });
    }

    return rest === 0
      ? t("duration.hours", { hours })
      : t("duration.hoursMinutes", { hours, minutes: rest });
  }

  function ago(elapsedMs: number) {
    const minutes = Math.floor(Math.max(0, elapsedMs) / MINUTE_MS);

    return minutes === 0
      ? t("freshness.justNow")
      : t("freshness.ago", { duration: duration(minutes) });
  }

  function uptime(percent: number) {
    const formatter = percent === 100 ? formats.fullUptime : formats.uptime;

    return formatter.format(percent / 100);
  }

  return {
    duration,
    ago,
    uptime,
    date: (iso: string) => formats.date.format(Date.parse(iso)),
    weekdayDate: (iso: string) => formats.weekdayDate.format(Date.parse(iso)),
    shortDate: (iso: string) => formats.shortDate.format(Date.parse(iso)),
    monthDay: (iso: string) => formats.monthDay.format(Date.parse(iso)),
    time: (iso: string) => formats.time.format(Date.parse(iso)),
    dateTime: (iso: string) => formats.dateTime.format(Date.parse(iso)),
    names: (items: string[]) => formats.names.format(items),
    clauses: (items: string[]) => formats.clauses.format(items),
  };
}
