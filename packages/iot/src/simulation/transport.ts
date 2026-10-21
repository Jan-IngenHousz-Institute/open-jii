import type { ITransportAdapter } from "../transport/interface";
import { getDemoRecording } from "./recordings";
import type { DemoSensorRecording, SimulatedSensorFamily } from "./recordings";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export class SimulatedTransportAdapter implements ITransportAdapter {
  private readonly recording: DemoSensorRecording;
  private connected = true;
  private receiver?: (data: string) => void;
  private status?: (connected: boolean, error?: Error) => void;
  private timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(
    family: SimulatedSensorFamily,
    private readonly delayMs = 150,
  ) {
    this.recording = getDemoRecording(family);
  }

  isConnected(): boolean {
    return this.connected;
  }

  send(data: string): Promise<void> {
    if (!this.connected) return Promise.reject(new Error("Simulated sensor is disconnected"));
    const command = data.trim();
    if (command === "-1+") {
      this.cancelPending();
      return Promise.resolve();
    }
    let reply: string;
    const { manifest, measurement, protocol } = this.recording;
    if (command === "hello") {
      reply = manifest.hello;
    } else if (command === "device_info") {
      const { sample: _sample, ...identity } = measurement;
      reply = `${JSON.stringify(identity)}\n`;
    } else if (command === "get_name") {
      reply = `${String(measurement.device_name)}\n`;
    } else if (command === "battery") {
      reply = `${String(measurement.device_battery)}\n`;
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(command);
      } catch {
        return Promise.reject(new Error("This command has no demo recording"));
      }
      if (canonicalJson(parsed) !== canonicalJson(protocol)) {
        return Promise.reject(new Error("This protocol has no demo recording"));
      }
      reply = `${JSON.stringify(measurement)}${manifest.frameFooter}\n`;
    }
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (this.connected) this.receiver?.(reply);
    }, this.delayMs);
    this.timers.add(timer);
    return Promise.resolve();
  }

  cancelPending(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }

  onDataReceived(callback: (data: string) => void): void {
    this.receiver = callback;
  }

  onStatusChanged(callback: (connected: boolean, error?: Error) => void): void {
    this.status = callback;
  }

  disconnect(): Promise<void> {
    this.cancelPending();
    this.connected = false;
    this.receiver = undefined;
    this.status?.(false);
    return Promise.resolve();
  }
}
