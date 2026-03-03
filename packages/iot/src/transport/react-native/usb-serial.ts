/**
 * React Native USB Serial Adapter
 * Requires: react-native-usb-serialport-for-android
 */
import type { UsbSerial } from "react-native-usb-serialport-for-android";
import { UsbSerialManager, Parity } from "react-native-usb-serialport-for-android";

import { delay } from "../../utils/async/async";
import { toHex, fromHex } from "../../utils/hex/hex";
import type { Logger } from "../../utils/logger/logger";
import { defaultLogger } from "../../utils/logger/logger";
import type { ITransportAdapter } from "../interface";

/**
 * Adapter for React Native USB Serial (Android only)
 */
export class RNUSBSerialAdapter implements ITransportAdapter {
  private port: UsbSerial | null = null;
  private connected = false;
  private dataCallback?: (data: string) => void;
  private statusCallback?: (connected: boolean, error?: Error) => void;

  private readonly log: Logger;

  constructor(port: UsbSerial, logger?: Logger) {
    this.port = port;
    this.log = logger ?? defaultLogger;
    this.setupListeners();
  }

  private setupListeners(): void {
    if (!this.port) return;

    this.port.onReceived((event) => {
      try {
        const data = fromHex(event.data);
        this.dataCallback?.(data);
      } catch (error) {
        this.log.error("Error decoding hex data:", error);
      }
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  async send(data: string): Promise<void> {
    if (!this.port) {
      throw new Error("Port not initialized");
    }

    const hexData = toHex(data);
    await this.port.send(hexData);
  }

  onDataReceived(callback: (data: string) => void): void {
    this.dataCallback = callback;
  }

  onStatusChanged(callback: (connected: boolean, error?: Error) => void): void {
    this.statusCallback = callback;
  }

  async disconnect(): Promise<void> {
    if (this.port) {
      try {
        await this.port.close();
        this.connected = false;
        this.statusCallback?.(false);
      } catch (error) {
        this.log.error("Error disconnecting:", error);
      }
    }
  }

  /** Maximum number of permission request attempts before giving up */
  static MAX_PERMISSION_RETRIES = 5;

  /**
   * Static factory method to create and connect to a USB device
   */
  static async connect(deviceId: number, logger?: Logger): Promise<RNUSBSerialAdapter> {
    // Request permission with a bounded retry loop
    for (let attempt = 0; attempt < RNUSBSerialAdapter.MAX_PERMISSION_RETRIES; attempt++) {
      if (await UsbSerialManager.hasPermission(deviceId)) {
        break;
      }
      if (await UsbSerialManager.tryRequestPermission(deviceId)) {
        break;
      }
      if (attempt === RNUSBSerialAdapter.MAX_PERMISSION_RETRIES - 1) {
        throw new Error(
          `USB permission denied after ${RNUSBSerialAdapter.MAX_PERMISSION_RETRIES} attempts`,
        );
      }
      await delay(2000);
    }

    // Open connection
    const port = await UsbSerialManager.open(deviceId, {
      baudRate: 115200,
      dataBits: 8,
      parity: Parity.None,
      stopBits: 1,
    });

    const adapter = new RNUSBSerialAdapter(port, logger);
    adapter.connected = true;
    adapter.statusCallback?.(true);

    return adapter;
  }
}
