import { useIsFetching } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

export function useEverLoaded(experimentId: string, mounted: boolean): boolean {
  const fetchingCount = useIsFetching({
    predicate: (query) => query.queryKey.includes(experimentId),
  });
  const sawFetchingRef = useRef(false);
  const [everLoaded, setEverLoaded] = useState(false);

  useEffect(() => {
    if (!mounted || everLoaded) {
      return;
    }
    if (fetchingCount > 0) {
      sawFetchingRef.current = true;
      return;
    }
    if (sawFetchingRef.current) {
      setEverLoaded(true);
    }
  }, [mounted, fetchingCount, everLoaded]);

  return everLoaded;
}
