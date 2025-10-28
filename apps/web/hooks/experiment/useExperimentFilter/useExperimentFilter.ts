import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import type { ExperimentFilter } from "../useExperiments/useExperiments";

export const useExperimentFilter = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawFilter = searchParams.get("filter");
  const filter: ExperimentFilter = rawFilter === "all" ? "all" : "member";

  // Clean up invalid filter in URL
  useEffect(() => {
    if (rawFilter !== null && rawFilter !== "all") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("filter");
      const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [rawFilter, router, searchParams]);

  const setFilter = (value: ExperimentFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.set("filter", "all");
    } else {
      params.delete("filter");
    }
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newUrl, { scroll: false });
  };

  return {
    filter,
    setFilter,
  };
};
