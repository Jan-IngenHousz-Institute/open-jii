import { format, parseISO } from "date-fns";

const YMD = "yyyy-MM-dd";
const HM = "HH:mm";
const YMD_HM = "yyyy-MM-dd HH:mm";

export function formatDate(dateString: string): string {
  if (!dateString) {
    return "N/A";
  }
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export function formatRelativeTime(value: Date | string, locale: string, now = Date.now()): string {
  const date = new Date(value);
  const diff = date.getTime() - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < HOUR) return rtf.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), "hour");
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / DAY), "day");
  return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export function formatShortDate(value: Date | string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function daysUntil(value: Date | string, now = Date.now()): number {
  return Math.ceil((new Date(value).getTime() - now) / DAY);
}

export function parseIsoDate(raw: unknown): Date | undefined {
  if (typeof raw !== "string" || raw === "") {
    return undefined;
  }
  const parsed = parseISO(raw);
  return Number.isFinite(parsed.getTime()) ? parsed : undefined;
}

export function applyTimeOfDay(date: Date, hhmm: string): Date {
  const [hhStr, mmStr] = hhmm.split(":");
  const hours = Number(hhStr);
  const minutes = Number(mmStr);
  const next = new Date(date);
  next.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return next;
}

export function formatYmd(date: Date): string {
  return format(date, YMD);
}

export function formatHm(date: Date): string {
  return format(date, HM);
}

export function formatYmdHm(date: Date): string {
  return format(date, YMD_HM);
}
