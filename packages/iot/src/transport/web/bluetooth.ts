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
    console.log("[WebBluetooth] Adapter created for device:", {
      id: device.id,
      name: device.name,
      hasGatt: !!device.gatt,
      serviceUUID: config.serviceUUID,
      writeUUID: config.writeUUID,
      notifyUUID: config.notifyUUID,
    });
    this.setupDisconnectListener();
  }

  private setupDisconnectListener(): void {
    if (!this.device) return;

    console.log("[WebBluetooth] Setting up disconnect listener");
    this.device.addEventListener("gattserverdisconnected", () => {
      console.warn("[WebBluetooth] GATT server disconnected event fired");
      this.connected = false;
      this.statusCallback?.(false);
    });
  }

  private async setupCharacteristics(): Promise<void> {
    if (!this.device || !this.server) return;

    console.log("[WebBluetooth] Getting primary service:", this.config.serviceUUID);
    const service = await this.server.getPrimaryService(this.config.serviceUUID);
    console.log("[WebBluetooth] Got primary service, uuid:", service.uuid);

    console.log("[WebBluetooth] Getting write characteristic:", this.config.writeUUID);
    this.writeCharacteristic = await service.getCharacteristic(this.config.writeUUID);
    console.log("[WebBluetooth] Got write characteristic, uuid:", this.writeCharacteristic.uuid);

    console.log("[WebBluetooth] Getting notify characteristic:", this.config.notifyUUID);
    this.notifyCharacteristic = await service.getCharacteristic(this.config.notifyUUID);
    console.log("[WebBluetooth] Got notify characteristic, uuid:", this.notifyCharacteristic.uuid);

    // Set up notifications
    console.log("[WebBluetooth] Starting notifications...");
    await this.notifyCharacteristic.startNotifications();
    console.log("[WebBluetooth] Notifications started successfully");
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

      console.log(
        "[WebBluetooth] Notification chunk received, length:",
        text.length,
        "preview:",
        text.substring(0, 200),
      );
      this.dataBuffer.push(text);

      // Check for end-of-message marker
      if (!text.endsWith("__EOM__")) {
        console.log(
          "[WebBluetooth] Buffering incomplete message, chunks so far:",
          this.dataBuffer.length,
        );
        return;
      }

      // Process complete message
      const fullData = this.dataBuffer.join("").slice(0, -7); // Remove __EOM__
      this.dataBuffer = [];
      console.log(
        "[WebBluetooth] Complete message received, length:",
        fullData.length,
        "preview:",
        fullData.substring(0, 500),
      );
      this.dataCallback?.(fullData);
    } catch (error) {
      console.error("[WebBluetooth] Error processing notification:", error);
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
    console.log(
      "[WebBluetooth] Sending data, length:",
      stringData.length,
      "preview:",
      stringData.substring(0, 200),
    );
    const encoder = new TextEncoder();
    const encoded = encoder.encode(stringData);

    await this.writeCharacteristic.writeValueWithResponse(encoded);
    console.log("[WebBluetooth] Data sent successfully, bytes:", encoded.length);
  }

  onDataReceived(callback: (data: string) => void): void {
    this.dataCallback = callback;
  }

  onStatusChanged(callback: (connected: boolean, error?: Error) => void): void {
    this.statusCallback = callback;
  }

  async disconnect(): Promise<void> {
    console.log("[WebBluetooth] Disconnecting...", { hasServer: !!this.server });
    if (this.server) {
      try {
        await this.notifyCharacteristic?.stopNotifications();
        this.server.disconnect();
        this.connected = false;
        this.statusCallback?.(false);
        console.log("[WebBluetooth] Disconnected successfully");
      } catch (error) {
        console.error("[WebBluetooth] Error disconnecting:", error);
      }
    }
  }

  /**
   * Check if Web Bluetooth is supported
   */
  static isSupported(): boolean {
    const supported = typeof navigator !== "undefined" && "bluetooth" in navigator;
    console.log("[WebBluetooth] isSupported check:", {
      supported,
      hasNavigator: typeof navigator !== "undefined",
      hasBluetooth: typeof navigator !== "undefined" && "bluetooth" in navigator,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "N/A",
    });
    return supported;
  }

  /**
   * Request device from user and connect
   */
  static async requestAndConnect(config: WebBluetoothConfig): Promise<WebBluetoothAdapter> {
    if (!WebBluetoothAdapter.isSupported()) {
      throw new Error("Web Bluetooth not supported in this browser");
    }

    console.log("[WebBluetooth] requestAndConnect — requesting device with config:", {
      serviceUUID: config.serviceUUID,
      writeUUID: config.writeUUID,
      notifyUUID: config.notifyUUID,
      filters: [{ services: [config.serviceUUID] }],
    });
    console.log(
      "[WebBluetooth] NOTE: The browser will show a device picker. " +
        "If the MultispeQ device does not appear, ensure it is powered on, " +
        "in pairing/advertising mode, and the service UUID matches the firmware.",
    );

    try {
      const device = await navigator.bluetooth?.requestDevice({
        filters: [{ services: [config.serviceUUID] }],
        optionalServices: [config.serviceUUID],
      });

      if (!device) {
        console.error("[WebBluetooth] requestDevice returned null/undefined — no device selected");
        throw new Error("No Bluetooth device selected");
      }

      console.log("[WebBluetooth] Device selected:", {
        id: device.id,
        name: device.name,
        hasGatt: !!device.gatt,
      });

      return await WebBluetoothAdapter.connect(device, config);
    } catch (err) {
      console.error("[WebBluetooth] requestDevice failed:", {
        error: err,
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : "unknown",
      });
      console.error(
        "[WebBluetooth] Troubleshooting tips:\n" +
          "  1. Is the device powered on and advertising?\n" +
          "  2. Is Bluetooth enabled on this computer?\n" +
          "  3. Is the service UUID correct? Expected: " +
          config.serviceUUID +
          "\n" +
          "  4. Are you using Chrome/Edge/Opera? (Firefox & Safari don't support Web Bluetooth)\n" +
          "  5. Is the page served over HTTPS or localhost?\n" +
          "  6. Did the user cancel the device picker dialog?",
      );
      throw err;
    }
  }

  /**
   * Connect to an existing Bluetooth device
   */
  static async connect(
    device: BluetoothDevice,
    config: WebBluetoothConfig,
  ): Promise<WebBluetoothAdapter> {
    console.log("[WebBluetooth] Connecting to device:", {
      id: device.id,
      name: device.name,
      hasGatt: !!device.gatt,
    });
    const adapter = new WebBluetoothAdapter(device, config);

    console.log("[WebBluetooth] Connecting to GATT server...");
    const gattServer = await device.gatt?.connect();
    if (!gattServer) {
      console.error(
        "[WebBluetooth] GATT server connection failed — device.gatt?.connect() returned:",
        gattServer,
      );
      throw new Error("Failed to connect to GATT server");
    }
    console.log("[WebBluetooth] GATT server connected, connected:", gattServer.connected);

    adapter.server = gattServer;
    console.log("[WebBluetooth] Setting up characteristics...");
    await adapter.setupCharacteristics();
    console.log("[WebBluetooth] Characteristics setup complete");

    adapter.connected = true;
    adapter.statusCallback?.(true);
    console.log("[WebBluetooth] Connection fully established");

    return adapter;
  }
}
