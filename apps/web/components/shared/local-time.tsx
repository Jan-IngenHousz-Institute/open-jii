"use client";

import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";

interface LocalTimeProps {
  value: string | Date;
  locale: string;
  /** "3 hours ago" rather than the date. */
  isRelative?: boolean;
}

/** A date in the reader's time zone, or relative to their clock, that hydrates without a mismatch. */
export function LocalTime({ value, locale, isRelative = false }: LocalTimeProps) {
  const format = useLocalDateFormat(locale);

  return isRelative ? format.relative(value) : format.date(value);
}
