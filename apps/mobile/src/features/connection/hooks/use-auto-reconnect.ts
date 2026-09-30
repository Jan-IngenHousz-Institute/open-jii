import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import {
  isConnectInFlight,
  useConnectedDevice,
  useConnectToDevice,
} from "~/features/connection/hooks/use-device-connection";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";

/**
 * Automatically attempts to reconnect to the last known device when the app
 * returns to the foreground and no device is currently connected.
 */
export function useAutoReconnect() {
  const { lastConnectedDevice } = useDeviceConnectionStore();
  const { data: connectedDevice } = useConnectedDevice();
  const { connectToDevice } = useConnectToDevice();

  // Use refs so the AppState listener always sees the latest values
  // without needing to re-subscribe on every render.
  const lastDeviceRef = useRef(lastConnectedDevice);
  lastDeviceRef.current = lastConnectedDevice;

  const connectedRef = useRef(connectedDevice);
  connectedRef.current = connectedDevice;

  const connectRef = useRef(connectToDevice);
  connectRef.current = connectToDevice;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      // The USB permission dialog backgrounds the app, so "active" also fires
      // mid-connect; any connect in flight (from any instance) wins.
      if (
        nextState === "active" &&
        lastDeviceRef.current &&
        !connectedRef.current &&
        !isConnectInFlight()
      ) {
        connectRef.current(lastDeviceRef.current).catch(() => {
          // Connection failed (e.g. device powered off) — no action needed.
          // The user can still tap the inline reconnect button manually.
        });
      }
    });

    return () => subscription.remove();
  }, []);
}
