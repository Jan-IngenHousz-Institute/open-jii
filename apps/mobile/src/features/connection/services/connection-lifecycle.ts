import type { QueryClient } from "@tanstack/react-query";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { connectionKeys } from "~/features/connection/services/connection-keys";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import type { Device } from "~/shared/types/device";

/**
 * The single home of disconnect-detection wiring, mounted once at app boot
 * (mirrors mountOutboxBridge). Two paths feed it:
 *
 *   1. Native onDeviceDisconnected — fires immediately when the OS reports
 *      a disconnect (when it bothers to). Invalidates the query so the UI
 *      flips to the disconnect state ASAP.
 *   2. QueryCache subscriber on the connected-device key — catches the
 *      polling-detected disconnect case (common on Android when the device
 *      is simply powered off and no native event fires) AND the native
 *      event case after the invalidation refetches null. Either way, the
 *      scanner executor store gets cleared exactly when data transitions
 *      from non-null → null.
 *
 * Returns an unmount fn that detaches both listeners.
 */
export function mountConnectionLifecycle({
  queryClient,
}: {
  queryClient: QueryClient;
}): () => void {
  const nativeSub = RNBluetoothClassic.onDeviceDisconnected(() => {
    void queryClient.invalidateQueries({ queryKey: connectionKeys.connectedDevice });
  });

  let prev: Device | null | undefined = queryClient.getQueryData(connectionKeys.connectedDevice);
  const unsubscribeCache = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated") return;
    if (event.query.queryKey[0] !== connectionKeys.connectedDevice[0]) return;
    const next = event.query.state.data as Device | null | undefined;
    if (prev && !next) {
      void useScannerCommandExecutorStore.getState().setDevice(undefined);
    }
    prev = next;
  });

  return () => {
    nativeSub.remove();
    unsubscribeCache();
  };
}
