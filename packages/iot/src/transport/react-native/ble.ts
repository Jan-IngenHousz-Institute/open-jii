/**
 * React Native BLE Adapter
 * Requires: react-native-ble-plx
 */
import type { Device, BleManager } from "react-native-ble-plx";

import { stringifyIfObject } from "../../utils/framing";
import type { ITransportAdapter } from "../interface";

export interface RNBLEConfig {
  serviceUUID: string;
  writeUUID: string;
  notifyUUID: string;
}

/**
 * Adapter for React Native BLE (Bluetooth Low Energy)
 */
export class RNBLEAdapter implements ITransportAdapter {
  private device: Device | null = null;
  private connected = false;
  private dataCallback?: (data: string) => void;
  private statusCallback?: (connected: boolean, error?: Error) => void;
  private dataBuffer: string[] = [];

  constructor(
    device: Device,
    private config: RNBLEConfig,
  ) {
    this.device = device;
  }

  private async setupNotifications(): Promise<void> {
    if (!this.device) return;

    await this.device.discoverAllServicesAndCharacteristics();

    this.device.monitorCharacteristicForService(
      this.config.serviceUUID,
      this.config.notifyUUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) {
          console.error("BLE notification error:", error);
          return;
        }

        try {
          const value = atob(characteristic.value);
          this.dataBuffer.push(value);

          // Check for end-of-message marker
          if (!value.endsWith("__EOM__")) {
            return;
          }

          // Process complete message
          const fullData = this.dataBuffer.join("").slice(0, -7); // Remove __EOM__
          this.dataBuffer = [];
          this.dataCallback?.(fullData);
        } catch (error) {
          console.error("Error processing BLE data:", error);
        }
      },
    );
  }

  isConnected(): boolean {
    return this.connected;
  }

  async send(data: string): Promise<void> {
    if (!this.device) {
      throw new Error("Device not initialized");
    }

    const stringData = stringifyIfObject(data);
    const base64Data = btoa(stringData);

    await this.device.writeCharacteristicWithResponseForService(
      this.config.serviceUUID,
      this.config.writeUUID,
      base64Data,
    );
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
        await this.device.cancelConnection();
        this.connected = false;
        this.statusCallback?.(false);
      } catch (error) {
        console.error("Error disconnecting:", error);
      }
    }
  }

  /**
   * Static factory method to create and connect to a BLE device
   */
  static async connect(
    deviceId: string,
    bleManager: BleManager,
    config: RNBLEConfig,
  ): Promise<RNBLEAdapter> {
    const device = await bleManager.connectToDevice(deviceId, { timeout: 10000 });
    const adapter = new RNBLEAdapter(device, config);
    await adapter.setupNotifications();
    adapter.connected = true;
    adapter.statusCallback?.(true);

    return adapter;
  }
}
