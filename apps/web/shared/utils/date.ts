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
