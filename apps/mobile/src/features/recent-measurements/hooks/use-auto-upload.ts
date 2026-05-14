import { useQueryClient } from "@tanstack/react-query";
import { addNetworkStateListener } from "expo-network";
import { useEffect, useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { toast } from "sonner-native";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import { resetUploadingMeasurements } from "~/shared/db/measurements-storage";

export function useAutoUpload() {
  const { failedUploads, uploadAll, isUploading } = useMeasurements();
  const queryClient = useQueryClient();

  const stateRef = useRef({ failedUploads, uploadAll, isUploading });
  stateRef.current = { failedUploads, uploadAll, isUploading };

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
    const { failedUploads, uploadAll, isUploading } = stateRef.current;
    if (autoUploadInFlight.current || failedUploads.length === 0 || isUploading) return;

    autoUploadInFlight.current = true;
    const count = failedUploads.length;

    toast.info(`Uploading ${count} unsynced measurement${count !== 1 ? "s" : ""}…`);
    try {
      await uploadAll();
      toast.success(`${count} measurement${count !== 1 ? "s" : ""} synced`);
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      autoUploadInFlight.current = false;
    }
  }, []);

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
