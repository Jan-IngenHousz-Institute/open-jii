/**
 * React Native Bluetooth Classic Adapter
 * Requires: react-native-bluetooth-classic
 */
import type { BluetoothDevice } from "react-native-bluetooth-classic";
import RNBluetoothClassic from "react-native-bluetooth-classic";

import type { ITransportAdapter } from "../interface";

/**
 * Adapter for React Native Bluetooth Classic
 */
export class RNBluetoothClassicAdapter implements ITransportAdapter {
  private device: BluetoothDevice | null = null;
  private connected = false;
  private dataCallback?: (data: string) => void;
  private statusCallback?: (connected: boolean, error?: Error) => void;

  constructor(device: BluetoothDevice) {
    this.device = device;
    this.setupListeners();
  }

  private setupListeners(): void {
    if (!this.device) return;

    this.device.onDataReceived((event) => {
      if (typeof event.data !== "string") {
        console.warn("Received non-string data:", typeof event.data);
        return;
      }

      this.dataCallback?.(event.data);
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  async send(data: string): Promise<void> {
    if (!this.device) {
      throw new Error("Device not initialized");
    }

    const success = await this.device.write(data);
    if (!success) {
      throw new Error("Failed to write to device");
    }
  }

  onDataReceived(callback: (data: string) => void): void {
    this.dataCallback = callback;
  }

  onStatusChanged(callback: (connected: boolean, error?: Error) => void): void {
    this.statusCallback = callback;
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        await this.device.disconnect();
        this.connected = false;
        this.statusCallback?.(false);
      } catch (error) {
        console.error("Error disconnecting:", error);
      }
    }
  }

  /**
   * Static factory method to create and connect to a device
   */
  static async connect(deviceId: string): Promise<RNBluetoothClassicAdapter> {
    try {
      await RNBluetoothClassic.connectToDevice(deviceId);
    } catch {
      // Retry once
      await RNBluetoothClassic.connectToDevice(deviceId);
    }

    const device = await RNBluetoothClassic.getConnectedDevice(deviceId);
    const adapter = new RNBluetoothClassicAdapter(device);
    adapter.connected = true;
    adapter.statusCallback?.(true);

    return adapter;
  }
}
