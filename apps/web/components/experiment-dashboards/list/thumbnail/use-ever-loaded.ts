import { useIsFetching } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

export function useEverLoaded(experimentId: string, mounted: boolean): boolean {
  const fetchingCount = useIsFetching({
    // oRPC nests the id inside an input object, so `queryKey.includes` — which
    // only scans the key's top level — never matches.
    predicate: (query) => JSON.stringify(query.queryKey).includes(experimentId),
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
