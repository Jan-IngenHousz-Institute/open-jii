import { toast } from "sonner-native";
import { exportMeasurementsToFile } from "~/features/recent-measurements/services/export-measurements";
import { useTranslation } from "~/shared/i18n";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("export-measurements");

// Shared export handler: owns the service call, error logging, and error toast.
export function useExportMeasurements() {
  const { t } = useTranslation("recentMeasurements");

  const exportMeasurements = () => {
    void exportMeasurementsToFile().catch((error) => {
      log.error("Failed to export measurements", { err: (error as Error)?.message });
      toast.error(t("recentMeasurements:alerts.exportError"));
    });
  };

  return { exportMeasurements };
}
