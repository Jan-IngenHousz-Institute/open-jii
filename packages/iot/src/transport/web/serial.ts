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

  constructor(port: any) {
    this.port = port;
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
    if (!this.port?.readable || this.reading) return;

    this.reading = true;
    this.reader = this.port.readable.getReader();

    try {
      const decoder = new TextDecoder();

      while (this.reading) {
        const { value, done } = await this.reader.read();

        if (done) {
          break;
        }

        if (value) {
          const text = decoder.decode(value, { stream: true });
          this.dataCallback?.(text);
        }
      }
    } catch (error) {
      console.error("Error reading from serial port:", error);
      this.statusCallback?.(false, error as Error);
    } finally {
      this.reader?.releaseLock();
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

    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    await this.writer.write(encoded);
  }

  onDataReceived(callback: (data: string) => void): void {
    this.dataCallback = callback;
  }

  onStatusChanged(callback: (connected: boolean, error?: Error) => void): void {
    this.statusCallback = callback;
  }

  async disconnect(): Promise<void> {
    this.reading = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
        this.reader.releaseLock();
      } catch (error) {
        console.error("Error releasing reader:", error);
      }
      this.reader = null;
    }

    if (this.writer) {
      try {
        this.writer.releaseLock();
      } catch (error) {
        console.error("Error releasing writer:", error);
      }
      this.writer = null;
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
  static async requestAndConnect(options?: any): Promise<WebSerialAdapter> {
    if (!WebSerialAdapter.isSupported()) {
      throw new Error("Web Serial not supported in this browser");
    }

    const port = await navigator.serial!.requestPort();
    return await WebSerialAdapter.connect(port, options);
  }

  /**
   * Connect to an existing serial port
   */
  static async connect(
    port: any,
    options: any = {
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
    },
  ): Promise<WebSerialAdapter> {
    await port.open(options);

    const adapter = new WebSerialAdapter(port);

    // Set up writer
    if (port.writable) {
      adapter.writer = port.writable.getWriter();
    }

    // Start reading
    adapter.startReading();

    adapter.connected = true;
    adapter.statusCallback?.(true);

    return adapter;
  }
}
