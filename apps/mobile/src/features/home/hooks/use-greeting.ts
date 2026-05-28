import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import { useTranslation } from "~/shared/i18n";
import type { SupportedLocale } from "~/shared/i18n";

interface Greeting {
  greeting: string;
  weekdayAndDate: string;
}

const LUXON_LOCALE: Record<SupportedLocale, string> = {
  "en-US": "en-GB",
  "nl-NL": "nl-NL",
};

export function useGreeting(): Greeting {
  const { t, i18n } = useTranslation("home");
  const [now, setNow] = useState(() => DateTime.now());

  useEffect(() => {
    const id = setInterval(() => setNow(DateTime.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hour = now.hour;
  const greetingKey =
    hour < 12 ? "greeting.morning" : hour < 18 ? "greeting.afternoon" : "greeting.evening";

  const luxonLocale = LUXON_LOCALE[i18n.language as SupportedLocale] ?? "en-GB";
  const weekdayAndDate = now.setLocale(luxonLocale).toFormat("cccc · d LLL");

  return {
    greeting: t(greetingKey),
    weekdayAndDate,
  };
}
