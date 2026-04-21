import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMeasurements } from "~/services/measurements-storage";
import { parseQuestions } from "~/utils/convert-cycle-answers-to-array";
import type { AnswerData } from "~/utils/convert-cycle-answers-to-array";

export type MeasurementStatus = "synced" | "unsynced" | "syncing";

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

export function useAllMeasurements(filter: MeasurementFilter = "all") {
  const queryClient = useQueryClient();

  const { data: allMeasurements = [] } = useQuery({
    queryKey: ["measurements"],
    queryFn: async () => {
      const [failedEntries, uploadingEntries, successfulEntries] = await Promise.all([
        getMeasurements("failed"),
        getMeasurements("uploading"),
        getMeasurements("successful"),
      ]);

      const unsynced: MeasurementItem[] = failedEntries.map(([key, data]) => ({
        key,
        timestamp: data.metadata.timestamp,
        experimentName: data.metadata.experimentName,
        status: "unsynced" as MeasurementStatus,
        questions: parseQuestions(data.measurementResult),
        data,
      }));

      const syncing: MeasurementItem[] = uploadingEntries.map(([key, data]) => ({
        key,
        timestamp: data.metadata.timestamp,
        experimentName: data.metadata.experimentName,
        status: "syncing" as MeasurementStatus,
        questions: parseQuestions(data.measurementResult),
        data,
      }));

      const synced: MeasurementItem[] = successfulEntries.map(([key, data]) => ({
        key,
        timestamp: data.metadata.timestamp,
        experimentName: data.metadata.experimentName,
        status: "synced" as MeasurementStatus,
        questions: parseQuestions(data.measurementResult),
        data,
      }));

      const combined = [...unsynced, ...syncing, ...synced];

      combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return combined;
    },
    networkMode: "always",
  });

  const filteredMeasurements = useMemo(
    () =>
      allMeasurements.filter((item) => {
        if (filter === "all") return true;
        if (filter === "synced") return item.status === "synced";
        if (filter === "unsynced") return item.status === "unsynced" || item.status === "syncing";
        return true;
      }),
    [allMeasurements, filter],
  );

  const uploadingCount = useMemo(
    () => allMeasurements.filter((item) => item.status === "syncing").length,
    [allMeasurements],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["measurements"] });
  };

  return {
    measurements: filteredMeasurements,
    allMeasurements,
    uploadingCount,
    invalidate,
  };
}
