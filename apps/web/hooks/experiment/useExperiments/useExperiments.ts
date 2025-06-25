import { useState } from "react";

import type { ExperimentStatus } from "@repo/api";

import { tsr } from "../../../lib/tsr";

export type ExperimentFilter = "my" | "member" | "related" | "all";

export const useExperiments = ({
  initialFilter = "my",
  initialStatus = undefined,
}: {
  initialFilter?: ExperimentFilter;
  initialStatus?: ExperimentStatus | undefined;
}) => {
  const [filter, setFilter] = useState<ExperimentFilter>(initialFilter);
  // status only holds actual status or undefined (all)
  const [status, setStatus] = useState<ExperimentStatus | undefined>(initialStatus);

  // When filter is "all", we don't pass any filter to the API

  const { data } = tsr.experiments.listExperiments.useQuery({
    queryData: {
      query: { filter: filter === "all" ? undefined : filter, status },
    },
    queryKey: ["experiments", filter, status],
  });

  // Return query result with filter and status controls
  return {
    data,
    filter,
    setFilter,
    status,
    setStatus,
  };
};
