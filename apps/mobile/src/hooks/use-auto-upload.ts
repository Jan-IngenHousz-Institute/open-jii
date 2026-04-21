import { useEffect, useCallback, useRef } from "react";
import { addNetworkStateListener } from "expo-network";
import { AppState } from "react-native";
import { toast } from "sonner-native";
import { useMeasurements } from "~/hooks/use-measurements";

export function useAutoUpload() {
  const { failedUploads, uploadAll, isUploading } = useMeasurements();

  const stateRef = useRef({ failedUploads, uploadAll, isUploading });
  stateRef.current = { failedUploads, uploadAll, isUploading };

  const initialCheckDone = useRef(false);

  const tryUpload = useCallback(async () => {
    const { failedUploads, uploadAll, isUploading } = stateRef.current;
    if (failedUploads.length === 0 || isUploading) return;

    const count = failedUploads.length;
    toast.info(`Uploading ${count} unsynced measurement${count !== 1 ? "s" : ""}…`);
    try {
      await uploadAll();
      toast.success(`${count} measurement${count !== 1 ? "s" : ""} synced`);
    } catch {
      toast.error("Upload failed. Please try again.");
    }
  }, []);

  // Trigger once when data first loads with unsynced measurements.
  useEffect(() => {
    if (initialCheckDone.current || failedUploads.length === 0) return;
    initialCheckDone.current = true;
    void tryUpload();
  }, [failedUploads.length, tryUpload]);

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
      wasReachable = isInternetReachable ?? null;
      if (restored) void tryUpload();
    });
    return () => sub.remove();
  }, [tryUpload]);
}
