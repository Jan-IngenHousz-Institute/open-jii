/**
 * Web Serial Adapter
 * Uses the Web Serial API (Chrome, Edge, Opera - desktop only)
 */
import type { ITransportAdapter } from "../interface";

// Web Serial API type declarations
declare global {
  interface Navigator {
    serial?: Serial;
  }
}

interface Serial {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
}

interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

interface SerialOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: "none" | "even" | "odd";
  bufferSize?: number;
  flowControl?: "none" | "hardware";
}

/**
 * Adapter for Web Serial API
 * Supported: Chrome, Edge, Opera (desktop only)
 * NOT supported: Mobile browsers, Firefox, Safari
 */
export class WebSerialAdapter implements ITransportAdapter {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private connected = false;
  private dataCallback?: (data: string) => void;
  private statusCallback?: (connected: boolean, error?: Error) => void;
  private reading = false;

  constructor(port: SerialPort) {
    this.port = port;
    console.log(
      "[WebSerial] Adapter created, port readable:",
      !!port.readable,
      "writable:",
      !!port.writable,
    );
    this.setupDisconnectListener();
  }

  private setupDisconnectListener(): void {
    if (!this.port || !navigator.serial) return;

    // Monitor port for disconnect events
    navigator.serial.addEventListener("disconnect", (event) => {
      if (event.target === this.port) {
        this.connected = false;
        this.statusCallback?.(false);
      }
    });
  }

  private async startReading(): Promise<void> {
    if (!this.port?.readable || this.reading) {
      console.warn(
        "[WebSerial] startReading skipped: readable:",
        !!this.port?.readable,
        "already reading:",
        this.reading,
      );
      return;
    }

    this.reading = true;
    this.reader = this.port.readable.getReader();
    console.log("[WebSerial] Read loop started, hasDataCallback:", !!this.dataCallback);

    try {
      const decoder = new TextDecoder();

      while (this.reading) {
        const { value, done } = await this.reader.read();

        if (done) {
          console.log("[WebSerial] Read stream done");
          break;
        }

        const text = decoder.decode(value, { stream: true });
        console.log(
          "[WebSerial] Received data, length:",
          text.length,
          "preview:",
          text.substring(0, 200),
        );
        this.dataCallback?.(text);
      }
    } catch (error) {
      console.error("[WebSerial] Error reading from serial port:", error);
      this.statusCallback?.(false, error as Error);
    } finally {
      console.log("[WebSerial] Read loop ended, reading:", this.reading);
      this.reader.releaseLock();
      this.reader = null;
      this.reading = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async send(data: string): Promise<void> {
    if (!this.writer) {
      throw new Error("Writer not initialized");
    }

    console.log(
      "[WebSerial] Sending data, length:",
      data.length,
      "preview:",
      data.substring(0, 200),
    );
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    await this.writer.write(encoded);
    console.log("[WebSerial] Data sent successfully, bytes:", encoded.length);
  }

  onDataReceived(callback: (data: string) => void): void {
    console.log("[WebSerial] Data callback registered");
    this.dataCallback = callback;
  }

  onStatusChanged(callback: (connected: boolean, error?: Error) => void): void {
    this.statusCallback = callback;
  }

  async disconnect(): Promise<void> {
    this.reading = false;

    // Grab local references — the startReading() finally block may null these out
    const reader = this.reader;
    const writer = this.writer;

    this.reader = null;
    this.writer = null;

    if (reader) {
      try {
        await reader.cancel();
        reader.releaseLock();
      } catch (error) {
        console.error("Error releasing reader:", error);
      }
    }

    if (writer) {
      try {
        writer.releaseLock();
      } catch (error) {
        console.error("Error releasing writer:", error);
      }
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (error) {
        console.error("Error closing port:", error);
      }
    }

    this.connected = false;
    this.statusCallback?.(false);
  }

  /**
   * Check if Web Serial is supported
   */
  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  /**
   * Request port from user and connect
   */
  static async requestAndConnect(options?: SerialOptions): Promise<WebSerialAdapter> {
    if (!WebSerialAdapter.isSupported()) {
      throw new Error("Web Serial not supported in this browser");
    }

    const port = await navigator.serial?.requestPort();

    if (!port) {
      throw new Error("No serial port selected");
    }

    return await WebSerialAdapter.connect(port, options);
  }

  /**
   * Connect to an existing serial port
   */
  static async connect(
    port: SerialPort,
    options: SerialOptions = {
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
    },
  ): Promise<WebSerialAdapter> {
    try {
      await port.open(options);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("open") || msg.includes("locked") || msg.includes("use")) {
        throw new Error(
          "Serial port is already in use. Close any other serial monitors (e.g. pio device monitor) and try again.",
        );
      }
      throw error;
    }

    const adapter = new WebSerialAdapter(port);

    // Set up writer
    if (port.writable) {
      adapter.writer = port.writable.getWriter();
    }

    // Start reading — if the port is grabbed by another process,
    // the read loop will error almost immediately with "device has been lost".
    // We use a short race to detect that before returning.
    const earlyError = new Promise<Error | null>((resolve) => {
      adapter.statusCallback = (connected, error) => {
        if (!connected && error) {
          resolve(error);
        }
      };
      // If no error after 300ms, the port is healthy
      setTimeout(() => resolve(null), 300);
    });

    void adapter.startReading();

    const portError = await earlyError;
    adapter.statusCallback = undefined;

    if (portError) {
      // Clean up before throwing
      adapter.connected = false;
      try {
        await adapter.disconnect();
      } catch {
        // ignore
      }
      throw new Error(
        "Serial port is already in use. Close any other serial monitors (e.g. pio device monitor) and try again.",
      );
    }

    adapter.connected = true;

    return adapter;
  }
}
