import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useDeviceConnectionStore } from "~/hooks/use-device-connection-store";
import {
  useConnectedDevice,
  useConnectToDevice,
} from "~/services/device-connection-manager/device-connection-hooks";

/**
 * Automatically attempts to reconnect to the last known Bluetooth device
 * when the app returns to the foreground and no device is currently connected.
 */
export function useAutoReconnect() {
  const { lastConnectedDevice } = useDeviceConnectionStore();
  const { data: connectedDevice } = useConnectedDevice();
  const { connectToDevice, connectingDeviceId } = useConnectToDevice();

  // Use refs so the AppState listener always sees the latest values
  // without needing to re-subscribe on every render.
  const lastDeviceRef = useRef(lastConnectedDevice);
  lastDeviceRef.current = lastConnectedDevice;

  const connectedRef = useRef(connectedDevice);
  connectedRef.current = connectedDevice;

  const connectingRef = useRef(connectingDeviceId);
  connectingRef.current = connectingDeviceId;

  const connectRef = useRef(connectToDevice);
  connectRef.current = connectToDevice;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        nextState === "active" &&
        lastDeviceRef.current &&
        !connectedRef.current &&
        !connectingRef.current
      ) {
        void connectRef.current(lastDeviceRef.current);
      }
    });

    return () => subscription.remove();
  }, []);
}
