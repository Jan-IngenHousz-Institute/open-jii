import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getFailedUploadsWithKeys } from "~/services/failed-uploads-storage";
import { getAllMeasurementComments } from "~/services/measurement-comments-storage";
import { getSuccessfulUploadsWithKeys } from "~/services/successful-uploads-storage";

export type MeasurementStatus = "synced" | "unsynced";

export interface MeasurementItem {
  key: string;
  timestamp: string;
  experimentName: string;
  status: MeasurementStatus;
  comment?: string;
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
    queryKey: ["allMeasurements"],
    queryFn: async () => {
      const [failedEntries, successfulEntries, commentsMap] = await Promise.all([
        getFailedUploadsWithKeys(),
        getSuccessfulUploadsWithKeys(),
        getAllMeasurementComments(),
      ]);

      const unsynced: MeasurementItem[] = failedEntries.map(([key, data]) => ({
        key,
        timestamp: data.metadata.timestamp,
        experimentName: data.metadata.experimentName,
        status: "unsynced" as MeasurementStatus,
        comment: commentsMap.get(key),
        data,
      }));

      const synced: MeasurementItem[] = successfulEntries.map(([key, data]) => ({
        key,
        timestamp: data.metadata.timestamp,
        experimentName: data.metadata.experimentName,
        status: "synced" as MeasurementStatus,
        comment: commentsMap.get(key),
        data,
      }));

      const combined = [...unsynced, ...synced];

      // Sort by timestamp (newest first)
      combined.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      });

      return combined;
    },
    networkMode: "always",
  });

  const filteredMeasurements = allMeasurements.filter((item) => {
    if (filter === "all") return true;
    if (filter === "synced") return item.status === "synced";
    if (filter === "unsynced") return item.status === "unsynced";
    return true;
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["allMeasurements"] });
  };

  return {
    measurements: filteredMeasurements,
    allMeasurements,
    invalidate,
  };
}
