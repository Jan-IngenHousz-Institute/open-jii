import { env } from "~/env";

import type { ITransportAdapter } from "@repo/iot";

/**
 * Dev-only escape hatch: fake MultispeQ devices behind the real driver, so the
 * multi-device workbook flow can be exercised (and e2e-tested) without a hub
 * full of hardware. Activated per-page with `?mockDevices=1`, and only outside
 * production builds (or when explicitly enabled via env).
 */
export function mockDevicesEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const allowed = env.NODE_ENV !== "production" || env.NEXT_PUBLIC_ENABLE_MOCK_DEVICES === "true";
  if (!allowed) return false;
  return new URLSearchParams(window.location.search).has("mockDevices");
}

/** Mock device index whose FIRST protocol run fails (later ones succeed). */
export const FAILING_MOCK_DEVICE_INDEX = 3;

const MOCK_REPLY_DELAY_MS = 700;

function mockMeasurement(index: number): Record<string, unknown> {
  return {
    device_id: `mock-${index}`,
    device_name: `Mock MultispeQ ${index}`,
    device_battery: 80 + index,
    device_version: "2.0-mock",
    // Fluorescence pair varies per device so a downstream Phi2 macro yields a
    // visibly different value for each sensor.
    Fm_prime: 1400 + index * 50,
    Fs: 400 + index * 40,
    sample: [
      {
        protocol_id: "mock",
        data_raw: Array.from({ length: 16 }, () => Math.round(Math.random() * 4096)),
      },
    ],
  };
}

/**
 * MultispeQ-flavored transport: replies to any command with newline-terminated
 * JSON, which is exactly what the real `MultispeqDriver` parses. The driver,
 * command queue, timeouts and framing all run for real; only the wire is fake.
 */
export class MockTransportAdapter implements ITransportAdapter {
  private connected = true;
  private dataCallback?: (data: string) => void;
  private statusCallback?: (connected: boolean, error?: Error) => void;
  private hasFailed = false;

  constructor(private readonly index: number) {}

  isConnected(): boolean {
    return this.connected;
  }

  send(data: string): Promise<void> {
    if (!this.connected) {
      return Promise.reject(new Error("device not open"));
    }
    // Protocols arrive as a JSON array; console commands as plain strings.
    const isProtocol = data.trimStart().startsWith("[");
    if (isProtocol && this.index === FAILING_MOCK_DEVICE_INDEX && !this.hasFailed) {
      this.hasFailed = true;
      return Promise.reject(new Error("Mock device failure (simulated)"));
    }
    const reply = isProtocol ? JSON.stringify(mockMeasurement(this.index)) : "MultispeQ Ready";
    setTimeout(() => this.dataCallback?.(`${reply}\n`), MOCK_REPLY_DELAY_MS);
    return Promise.resolve();
  }

  onDataReceived(callback: (data: string) => void): void {
    this.dataCallback = callback;
  }

  onStatusChanged(callback: (connected: boolean, error?: Error) => void): void {
    this.statusCallback = callback;
  }

  disconnect(): Promise<void> {
    this.connected = false;
    this.statusCallback?.(false);
    return Promise.resolve();
  }
}
