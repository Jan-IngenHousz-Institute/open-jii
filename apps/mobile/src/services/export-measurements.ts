import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getFailedUploadsWithKeys } from "~/services/failed-uploads-storage";
import { getSuccessfulUploadsWithKeys } from "~/services/successful-uploads-storage";

export async function exportMeasurementsToFile(): Promise<void> {
  const [failedEntries, successfulEntries] = await Promise.all([
    getFailedUploadsWithKeys(),
    getSuccessfulUploadsWithKeys(),
  ]);

  const measurements = [
    ...failedEntries.map(([key, data]) => ({
      key,
      status: "unsynced" as const,
      timestamp: data.metadata.timestamp,
      experimentName: data.metadata.experimentName,
      data,
    })),
    ...successfulEntries.map(([key, data]) => ({
      key,
      status: "synced" as const,
      timestamp: data.metadata.timestamp,
      experimentName: data.metadata.experimentName,
      data,
    })),
  ];

  measurements.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    totalCount: measurements.length,
    syncedCount: successfulEntries.length,
    unsyncedCount: failedEntries.length,
    measurements,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `measurements-export-${timestamp}.json`;

  const file = new File(Paths.cache, fileName);
  file.create();
  file.write(JSON.stringify(exportData, null, 2));

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    dialogTitle: "Export Measurements",
  });
}
