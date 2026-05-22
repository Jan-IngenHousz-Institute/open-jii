import { useQueryClient } from "@tanstack/react-query";
import { addNetworkStateListener, useNetworkState } from "expo-network";
import { useEffect, useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { toast } from "sonner-native";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import { resetUploadingMeasurements } from "~/shared/db/measurements-storage";
import { useTranslation } from "~/shared/i18n";

export function useAutoUpload() {
  const { failedUploads, uploadAll, isUploading } = useMeasurements();
  const queryClient = useQueryClient();
  const { t } = useTranslation(["common", "recentMeasurements"]);
  const networkState = useNetworkState();

  const stateRef = useRef({ failedUploads, uploadAll, isUploading, networkState });
  stateRef.current = { failedUploads, uploadAll, isUploading, networkState };

  const initialCheckDone = useRef(false);
  const autoUploadInFlight = useRef(false);
  const [resetDone, setResetDone] = useState(false);

  // Reset any items stuck in "uploading" from a previous crashed session,
  // then invalidate so failedUploads includes recovered rows before first upload.
  useEffect(() => {
    void (async () => {
      await resetUploadingMeasurements();
      await queryClient.invalidateQueries({ queryKey: ["measurements"] });
      setResetDone(true);
    })();
  }, [queryClient]);

  const tryUpload = useCallback(async () => {
    const { failedUploads, uploadAll, isUploading, networkState } = stateRef.current;
    if (autoUploadInFlight.current || failedUploads.length === 0 || isUploading) return;
    // Treat anything other than confirmed-online as offline — initial null/
    // undefined windows shouldn't fire a publish that's certain to fail.
    // The dedicated network-restore listener will re-trigger on reconnect.
    if (networkState.isInternetReachable !== true) {
      console.log("[auto-upload] skip: offline", {
        isInternetReachable: networkState.isInternetReachable,
      });
      return;
    }

    autoUploadInFlight.current = true;
    try {
      await uploadAll();
    } catch {
      toast.error(t("recentMeasurements:toasts.uploadFailed"));
    } finally {
      autoUploadInFlight.current = false;
    }
  }, [t]);

  // Trigger once when data first loads with unsynced measurements,
  // after stuck-row reset has flushed into the query cache.
  useEffect(() => {
    if (!resetDone || initialCheckDone.current || failedUploads.length === 0) return;
    initialCheckDone.current = true;
    void tryUpload();
  }, [resetDone, failedUploads.length, tryUpload]);

  // Trigger on every foreground transition.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void tryUpload();
    });
    return () => sub.remove();
  }, [tryUpload]);

  // Trigger when connection is restored (offline → online).
  useEffect(() => {
    let wasReachable: boolean | null = null;
    const sub = addNetworkStateListener(({ isInternetReachable }) => {
      const restored = wasReachable === false && isInternetReachable === true;
      if (isInternetReachable === true || isInternetReachable === false) {
        wasReachable = isInternetReachable;
      }
      if (restored) void tryUpload();
    });
    return () => sub.remove();
  }, [tryUpload]);
}
