import { useIsFetching } from "@tanstack/react-query";
import { useState } from "react";

export function useEverLoaded(experimentId: string, mounted: boolean): boolean {
  const fetchingCount = useIsFetching({
    // oRPC nests the id inside an input object, so `queryKey.includes` — which
    // only scans the key's top level — never matches.
    predicate: (query) => JSON.stringify(query.queryKey).includes(experimentId),
  });
  const [phase, setPhase] = useState<"idle" | "fetching" | "loaded">("idle");

  if (mounted && phase !== "loaded") {
    if (fetchingCount > 0) {
      if (phase === "idle") {
        setPhase("fetching");
      }
    } else if (phase === "fetching") {
      setPhase("loaded");
    }
  }

  return phase === "loaded";
}
