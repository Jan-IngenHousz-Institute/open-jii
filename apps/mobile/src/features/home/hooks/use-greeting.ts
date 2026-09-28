import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import { useTranslation } from "~/shared/i18n";
import { luxonLocale } from "~/shared/i18n/luxon-locale";

interface Greeting {
  greeting: string;
  weekdayAndDate: string;
}

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

  const weekdayAndDate = now.setLocale(luxonLocale(i18n.language)).toFormat("cccc · d LLL");

  return {
    greeting: t(greetingKey),
    weekdayAndDate,
  };
}
