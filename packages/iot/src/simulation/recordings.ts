import ambitManifest from "../demo-sensors/ambit/manifest.json";
import ambitProtocol from "../demo-sensors/ambit/protocol.json";
import ambitRecording from "../demo-sensors/ambit/recording.placeholder.json";
import miniparManifest from "../demo-sensors/minipar/manifest.json";
import miniparProtocol from "../demo-sensors/minipar/protocol.json";
import miniparRecording from "../demo-sensors/minipar/recording.placeholder.json";
import multispeqManifest from "../demo-sensors/multispeq/manifest.json";
import multispeqProtocol from "../demo-sensors/multispeq/protocol.json";
import multispeqRecording from "../demo-sensors/multispeq/recording.placeholder.json";

export const SIMULATED_SENSOR_FAMILIES = ["multispeq", "ambit", "minipar"] as const;
export type SimulatedSensorFamily = (typeof SIMULATED_SENSOR_FAMILIES)[number];

export interface DemoSensorRecording {
  manifest: {
    family: string;
    placeholder: boolean;
    recordingVersion: number;
    firmwareVersion: string;
    protocolVersion: string;
    hello: string;
    frameFooter: string;
  };
  protocol: Record<string, unknown>[];
  measurement: Record<string, unknown> & { sample: Record<string, unknown>[] };
}

const recordings: Record<SimulatedSensorFamily, DemoSensorRecording> = {
  multispeq: {
    manifest: multispeqManifest,
    protocol: multispeqProtocol,
    measurement: multispeqRecording,
  },
  ambit: { manifest: ambitManifest, protocol: ambitProtocol, measurement: ambitRecording },
  minipar: { manifest: miniparManifest, protocol: miniparProtocol, measurement: miniparRecording },
};

export function simulatedDeviceId(family: SimulatedSensorFamily): string {
  return `simulated:${family}`;
}

export function getDemoRecording(family: SimulatedSensorFamily): DemoSensorRecording {
  const recording = recordings[family];
  if (
    recording.manifest.family !== family ||
    recording.manifest.recordingVersion !== 1 ||
    recording.protocol.length === 0 ||
    recording.measurement.sample.length === 0
  ) {
    throw new Error("Invalid demo sensor recording");
  }
  return JSON.parse(JSON.stringify(recording)) as DemoSensorRecording;
}
