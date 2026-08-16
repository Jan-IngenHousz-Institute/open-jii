import type { DeviceMeasurement, DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

export type ActivityKind = "connected" | "disconnected" | "firmwareChanged" | "registered";

export interface ActivityEntry {
  timestamp: string;
  kind: ActivityKind;
  /** Free-form context: a disconnect reason, a version transition. */
  detail: string | null;
}

interface ActivitySources {
  monitoring: DeviceMonitoring;
  /** Registry creation, included when it falls inside the window. */
  registeredAt?: string | null;
  from: string;
  to: string;
}

/**
 * Everything that happened to this device in the window, not just the broker
 * events: connections, firmware transitions seen in the measurement stream,
 * and its registration when that falls inside the window.
 */
export function buildDeviceActivity({
  monitoring,
  registeredAt,
  from,
  to,
}: ActivitySources): ActivityEntry[] {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();

  const lifecycle: ActivityEntry[] = monitoring.events.map((event) => ({
    timestamp: event.eventTimestamp,
    kind: event.eventType,
    detail: event.disconnectReason,
  }));

  const registration: ActivityEntry[] =
    registeredAt != null && withinWindow(registeredAt, fromMs, toMs)
      ? [{ timestamp: registeredAt, kind: "registered", detail: null }]
      : [];

  return [...lifecycle, ...registration, ...firmwareChanges(monitoring.recentMeasurements)].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

function withinWindow(timestamp: string, fromMs: number, toMs: number): boolean {
  const at = new Date(timestamp).getTime();
  return at >= fromMs && at <= toMs;
}

/**
 * Firmware transitions read off the measurement stream. Measurements arrive
 * newest-first, so a change is recorded at the first row reporting the new
 * version, which is the moment it became visible to the platform.
 */
function firmwareChanges(measurements: DeviceMeasurement[]): ActivityEntry[] {
  const changes: ActivityEntry[] = [];

  for (const [position, measurement] of measurements.entries()) {
    const previous = measurements.at(position + 1);
    if (previous === undefined) {
      continue;
    }

    const before = previous.deviceVersion;
    const after = measurement.deviceVersion;
    if (before === null || after === null || before === after) {
      continue;
    }

    changes.push({
      timestamp: measurement.timestamp,
      kind: "firmwareChanged",
      detail: `${before} → ${after}`,
    });
  }

  return changes;
}
