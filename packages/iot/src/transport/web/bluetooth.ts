/**
 * Web Bluetooth Adapter
 * Uses the Web Bluetooth API (Chrome, Edge, Opera)
 */
import { stringifyIfObject } from "../../utils/framing";
import type { ITransportAdapter } from "../interface";

// Web Bluetooth API type declarations
declare global {
  interface Navigator {
    bluetooth?: Bluetooth;
  }
}

interface Bluetooth {
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
}

interface RequestDeviceOptions {
  filters?: BluetoothLEScanFilter[];
  optionalServices?: BluetoothServiceUUID[];
}

interface BluetoothLEScanFilter {
  services?: BluetoothServiceUUID[];
  name?: string;
  namePrefix?: string;
}

type BluetoothServiceUUID = string | number;
type BluetoothCharacteristicUUID = string | number;

interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

interface BluetoothRemoteGATTServer {
  device: BluetoothDevice;
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothRemoteGATTService {
  device: BluetoothDevice;
  uuid: string;
  getCharacteristic(
    characteristic: BluetoothCharacteristicUUID,
  ): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  service: BluetoothRemoteGATTService;
  uuid: string;
  value?: DataView;
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithResponse(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

export interface WebBluetoothConfig {
  serviceUUID: string;
  writeUUID: string;
  notifyUUID: string;
}

/**
 * Adapter for Web Bluetooth API
 * Supported: Chrome, Edge, Opera (desktop + Android)
 * NOT supported: iOS Safari, Firefox
 */
export class WebBluetoothAdapter implements ITransportAdapter {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private notifyCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private connected = false;
  private dataCallback?: (data: string) => void;
  private statusCallback?: (connected: boolean, error?: Error) => void;
  private dataBuffer: string[] = [];

  constructor(
    device: BluetoothDevice,
    private config: WebBluetoothConfig,
  ) {
    this.device = device;
    this.setupDisconnectListener();
  }

  private setupDisconnectListener(): void {
    if (!this.device) return;

    this.device.addEventListener("gattserverdisconnected", () => {
      this.connected = false;
      this.statusCallback?.(false);
    });
  }

  private async setupCharacteristics(): Promise<void> {
    if (!this.device || !this.server) return;

    const service = await this.server.getPrimaryService(this.config.serviceUUID);

    this.writeCharacteristic = await service.getCharacteristic(this.config.writeUUID);
    this.notifyCharacteristic = await service.getCharacteristic(this.config.notifyUUID);

    // Set up notifications
    await this.notifyCharacteristic.startNotifications();
    this.notifyCharacteristic.addEventListener("characteristicvaluechanged", (event) => {
      this.handleNotification(event);
    });
  }

  private handleNotification(event: Event): void {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    const value = characteristic.value;
    if (!value) return;

    try {
      const decoder = new TextDecoder();
      const text = decoder.decode(value);

      this.dataBuffer.push(text);

      // Check for end-of-message marker
      if (!text.endsWith("__EOM__")) {
        return;
      }

      // Process complete message
      const fullData = this.dataBuffer.join("").slice(0, -7); // Remove __EOM__
      this.dataBuffer = [];
      this.dataCallback?.(fullData);
    } catch (error) {
      console.error("Error processing notification:", error);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async send(data: string): Promise<void> {
    if (!this.writeCharacteristic) {
      throw new Error("Write characteristic not initialized");
    }

    const stringData = stringifyIfObject(data);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(stringData);

    await this.writeCharacteristic.writeValueWithResponse(encoded);
  }

  onDataReceived(callback: (data: string) => void): void {
    this.dataCallback = callback;
  }

  onStatusChanged(callback: (connected: boolean, error?: Error) => void): void {
    this.statusCallback = callback;
  }

  async disconnect(): Promise<void> {
    if (this.server) {
      try {
        await this.notifyCharacteristic?.stopNotifications();
        this.server.disconnect();
        this.connected = false;
        this.statusCallback?.(false);
      } catch (error) {
        console.error("Error disconnecting:", error);
      }
    }
  }

  /**
   * Check if Web Bluetooth is supported
   */
  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  /**
   * Request device from user and connect
   */
  static async requestAndConnect(config: WebBluetoothConfig): Promise<WebBluetoothAdapter> {
    if (!WebBluetoothAdapter.isSupported()) {
      throw new Error("Web Bluetooth not supported in this browser");
    }

    const device = await navigator.bluetooth?.requestDevice({
      filters: [{ services: [config.serviceUUID] }],
      optionalServices: [config.serviceUUID],
    });

    if (!device) {
      throw new Error("No Bluetooth device selected");
    }

    return await WebBluetoothAdapter.connect(device, config);
  }

  /**
   * Connect to an existing Bluetooth device
   */
  static async connect(
    device: BluetoothDevice,
    config: WebBluetoothConfig,
  ): Promise<WebBluetoothAdapter> {
    const adapter = new WebBluetoothAdapter(device, config);

    const gattServer = await device.gatt?.connect();
    if (!gattServer) {
      throw new Error("Failed to connect to GATT server");
    }

    adapter.server = gattServer;
    await adapter.setupCharacteristics();

    adapter.connected = true;
    adapter.statusCallback?.(true);

    return adapter;
  }
}
