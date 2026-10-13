import { useIsHydrated } from "@/hooks/useIsHydrated";
import { formatDateTime, formatRelativeTime, formatShortDate } from "@/util/date";

interface LocalDateFormat {
  date: (value: Date | string) => string;
  dateTime: (value: Date | string) => string;
  /** The date, until the page has hydrated. */
  relative: (value: Date | string) => string;
}

/**
 * Formats in the reader's time zone and against their clock. The server renders in UTC at its own
 * moment, so until the page has hydrated these format in UTC as the server did, and the reader's own
 * follow on the next render; otherwise React discards the server's HTML over the difference.
 */
export function useLocalDateFormat(locale: string): LocalDateFormat {
  const isHydrated = useIsHydrated();
  const timeZone = isHydrated ? undefined : "UTC";

  return {
    date: (value) => formatShortDate(value, locale, timeZone),
    dateTime: (value) => formatDateTime(value, locale, timeZone),
    relative: (value) =>
      isHydrated ? formatRelativeTime(value, locale) : formatShortDate(value, locale, timeZone),
  };
}
