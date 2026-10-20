import { useIsHydrated } from "@/hooks/useIsHydrated";
import { useMemo, useState } from "react";

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * A value this browser remembers across visits, such as a dismissed notice. It reads as
 * null until the page has hydrated: the server cannot see the browser's storage, and the
 * two renders would otherwise disagree on the markup.
 */
export function useRememberedValue(key: string) {
  const isHydrated = useIsHydrated();
  const stored = useMemo(() => (isHydrated ? readStored(key) : null), [isHydrated, key]);
  const [chosenNow, setChosenNow] = useState<string | null>(null);

  const remember = (value: string) => {
    setChosenNow(value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // A browser refusing storage still keeps the choice for this visit.
    }
  };

  return { value: chosenNow ?? stored, remember, isHydrated };
}
