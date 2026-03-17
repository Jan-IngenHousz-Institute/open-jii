/**
 * Transport adapter interface - abstracts the underlying communication channel
 */

/** Abstract transport adapter interface */
export interface ITransportAdapter {
  /** Check if transport is connected */
  isConnected(): boolean;

  /** Send raw data to device */
  send(data: string): Promise<void>;

  /** Register callback for received data */
  onDataReceived(callback: (data: string) => void): void;

  /** Register callback for status changes */
  onStatusChanged(callback: (connected: boolean, error?: Error) => void): void;

  /** Disconnect and cleanup */
  disconnect(): Promise<void>;
}

/** Factory function type for creating transport adapters */
export type TransportAdapterFactory = (deviceId: string) => Promise<ITransportAdapter>;
