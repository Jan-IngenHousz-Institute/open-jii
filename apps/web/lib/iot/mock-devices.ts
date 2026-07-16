import { env } from "~/env";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import type { ITransportAdapter } from "@repo/iot";

/**
 * Dev-only escape hatch: fake devices behind the real drivers, so the
 * multi-device workbook flow can be exercised (and e2e-tested) without a hub
 * full of hardware. Activated per-page with `?mockDevices=1` (MultispeQs) or
 * `?mockDevices=multispeq,ambit,minipar` (one mock per listed family), and
 * only outside production builds (or when explicitly enabled via env).
 */
export function mockDevicesEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const allowed = env.NODE_ENV !== "production" || env.NEXT_PUBLIC_ENABLE_MOCK_DEVICES === "true";
  if (!allowed) return false;
  return new URLSearchParams(window.location.search).has("mockDevices");
}

/** Families a mock transport can imitate (ambyte is never locally connectable). */
export type MockDeviceFamily = Extract<SensorFamily, "multispeq" | "ambit" | "minipar">;

const MOCK_FAMILIES: readonly MockDeviceFamily[] = ["multispeq", "ambit", "minipar"];

function isMockFamily(value: string): value is MockDeviceFamily {
  return (MOCK_FAMILIES as readonly string[]).includes(value);
}

/**
 * Families listed in `?mockDevices=`. Successive connect clicks cycle through
 * the list. Bare `?mockDevices=1` (or any non-family value) keeps the legacy
 * behavior: every mock is a MultispeQ.
 */
export function parseMockFamilies(): MockDeviceFamily[] {
  if (typeof window === "undefined") return ["multispeq"];
  const value = new URLSearchParams(window.location.search).get("mockDevices") ?? "";
  const families = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(isMockFamily);
  return families.length > 0 ? families : ["multispeq"];
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

function multispeqDeviceInfo(index: number): Record<string, unknown> {
  return {
    device_name: `Mock MultispeQ ${index}`,
    device_version: "2.0-mock",
    device_id: `mock-${index}`,
    device_battery: 80 + index,
    device_firmware: "2.311-mock",
  };
}

/** miniPAR JSON-mode measurement envelope, footer included (firmware appends `7A1E3AA1`). */
function miniparEnvelope(index: number): string {
  const envelope = {
    device_name: `Mock MiniPAR ${index}`,
    device_version: "1.1",
    device_id: `mp:mock:${index}`,
    device_battery: "NaN",
    device_firmware: 1.04,
    sample: [{ protocol_id: "NaN", set: [{ label: "par", par: 340 + index * 10 }] }],
  };
  return `${JSON.stringify(envelope)}7A1E3AA1`;
}

/**
 * Fake transport behind the real drivers: each family replies with its
 * firmware's actual wire signatures (hello handshakes included), so
 * `identifyDevice` and the drivers' framing all run for real; only the wire
 * is fake.
 */
export class MockTransportAdapter implements ITransportAdapter {
  private connected = true;
  private dataCallback?: (data: string) => void;
  private statusCallback?: (connected: boolean, error?: Error) => void;
  private hasFailed = false;

  constructor(
    private readonly index: number,
    private readonly family: MockDeviceFamily = "multispeq",
  ) {}

  isConnected(): boolean {
    return this.connected;
  }

  send(data: string): Promise<void> {
    if (!this.connected) {
      return Promise.reject(new Error("device not open"));
    }
    const payload = data.trim();
    // Protocols arrive as a JSON array; console commands as plain strings.
    const isProtocol = payload.startsWith("[");
    if (
      isProtocol &&
      this.family === "multispeq" &&
      this.index === FAILING_MOCK_DEVICE_INDEX &&
      !this.hasFailed
    ) {
      this.hasFailed = true;
      return Promise.reject(new Error("Mock device failure (simulated)"));
    }
    const reply = this.buildReply(payload, isProtocol);
    if (reply !== undefined) {
      setTimeout(() => this.dataCallback?.(reply), MOCK_REPLY_DELAY_MS);
    }
    return Promise.resolve();
  }

  /** Per-family reply table; `undefined` means the device stays silent. */
  private buildReply(payload: string, isProtocol: boolean): string | undefined {
    switch (this.family) {
      case "multispeq": {
        if (isProtocol) return `${JSON.stringify(mockMeasurement(this.index))}\n`;
        if (payload === "device_info") {
          return `${JSON.stringify(multispeqDeviceInfo(this.index))}\n`;
        }
        return "MultispeQ Ready\n";
      }
      case "ambit": {
        if (payload === "hello") return `NEW Mock Ambit ${this.index} Ready\n`;
        // Calibration writers reply with nothing at all, like the firmware.
        if (payload.startsWith("set_")) return undefined;
        if (payload === "get_par" || payload === "PAR") {
          return `${(120 + this.index).toFixed(1)}\n415,388,402,390,377,365,401,388,352,343\n`;
        }
        if (payload === "temp") return "23.1\t22.4\t23.0\n";
        return "BAD COMMAND\n";
      }
      case "minipar": {
        // JSON mode: protocol arrays/objects get the measurement envelope + footer.
        if (isProtocol || payload.startsWith("{")) return `${miniparEnvelope(this.index)}\n`;
        // Firmware replies to hello via Serial.print: no trailing newline.
        if (payload === "hello") return '{"device":"MiniPAR","version":"1.1"}';
        if (payload === "get_name") return `Mock MiniPAR ${this.index}\n`;
        if (payload === "par") return `${(340 + this.index * 10).toFixed(2)}\n`;
        if (payload === "battery") return "NaN\n";
        return "error:unknown_command\n";
      }
    }
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
