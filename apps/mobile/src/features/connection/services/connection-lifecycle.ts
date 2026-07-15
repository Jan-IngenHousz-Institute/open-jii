import type { QueryClient } from "@tanstack/react-query";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { connectionKeys } from "~/features/connection/services/connection-keys";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { Device } from "~/shared/types/device";

/**
 * The single home of disconnect-detection wiring, mounted once at app boot
 * (mirrors mountOutboxBridge). Two paths feed it:
 *
 *   1. Native onDeviceDisconnected: fires immediately when the OS reports
 *      a disconnect (when it bothers to). Invalidates the query so the UI
 *      flips to the disconnect state ASAP.
 *   2. QueryCache subscriber on the connected-devices key: catches the
 *      polling-detected disconnect case (common on Android when the device
 *      is simply powered off or unplugged and no native event fires) AND
 *      the native event case after the invalidation refetches. The id-set
 *      diff clears exactly the disappeared devices' executors, so unplugging
 *      one of N hub devices fails only that device's in-flight scan.
 *
 * Returns an unmount fn that detaches both listeners.
 */
export function mountConnectionLifecycle({
  queryClient,
}: {
  queryClient: QueryClient;
}): () => void {
  const nativeSub = RNBluetoothClassic.onDeviceDisconnected(() => {
    void queryClient.invalidateQueries({ queryKey: connectionKeys.connectedDevices });
  });

  let prevIds = new Set<string>(
    queryClient.getQueryData<Device[]>(connectionKeys.connectedDevices)?.map((d) => d.id) ?? [],
  );
  const unsubscribeCache = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated") return;
    if (event.query.queryKey[0] !== connectionKeys.connectedDevices[0]) return;
    const next = event.query.state.data as Device[] | undefined;
    if (next === undefined) return;
    const nextIds = new Set(next.map((d) => d.id));
    prevIds.forEach((id) => {
      if (!nextIds.has(id)) {
        void useScannerCommandExecutorStore.getState().removeDevice(id);
      }
    });
    prevIds = nextIds;
  });

  return () => {
    nativeSub.remove();
    unsubscribeCache();
  };
}
