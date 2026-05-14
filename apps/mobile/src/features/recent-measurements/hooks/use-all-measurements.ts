import { useQuery, useQueryClient } from "@tanstack/react-query";
import { countMeasurementsByStatus, getMeasurements } from "~/services/measurements-storage";
import type { MeasurementCounts } from "~/services/measurements-storage";
import type { MeasurementStatus } from "~/services/measurements-storage";
import { parseQuestions } from "~/utils/convert-cycle-answers-to-array";
import type { AnswerData } from "~/utils/convert-cycle-answers-to-array";

export type { MeasurementStatus } from "~/services/measurements-storage";

export interface MeasurementItem {
  key: string;
  timestamp: string;
  experimentName: string;
  status: MeasurementStatus;
  questions: AnswerData[];
  data: {
    topic: string;
    measurementResult: object;
    metadata: {
      experimentName: string;
      protocolName: string;
      timestamp: string;
    };
  };
}

export type MeasurementFilter = "all" | "synced" | "unsynced";

function statusesForFilter(filter: MeasurementFilter): MeasurementStatus[] {
  if (filter === "synced") return ["successful"];
  if (filter === "unsynced") return ["pending", "failed", "uploading"];
  return ["pending", "failed", "uploading", "successful"];
}

const EMPTY_COUNTS: MeasurementCounts = {
  pending: 0,
  uploading: 0,
  failed: 0,
  successful: 0,
};

export function useAllMeasurements(filter: MeasurementFilter = "all") {
  const queryClient = useQueryClient();

  // Only fetch the rows the filter actually wants — filtering happens in SQL.
  const { data: measurements = [] } = useQuery({
    queryKey: ["measurements", "list", filter],
    queryFn: async () => {
      const rows = await getMeasurements(statusesForFilter(filter));
      const items: MeasurementItem[] = rows.map(({ id, status, data }) => ({
        key: id,
        timestamp: data.metadata.timestamp,
        experimentName: data.metadata.experimentName,
        status,
        questions: parseQuestions(data.measurementResult),
        data,
      }));
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return items;
    },
    networkMode: "always",
  });

  // Lightweight COUNT … GROUP BY status — independent of the active filter so
  // toolbar counts and counts shown in confirmations stay accurate.
  const { data: counts = EMPTY_COUNTS } = useQuery({
    queryKey: ["measurements", "counts"],
    queryFn: countMeasurementsByStatus,
    networkMode: "always",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["measurements"] });
  };

  return {
    measurements,
    counts,
    uploadingCount: counts.uploading,
    invalidate,
  };
}
