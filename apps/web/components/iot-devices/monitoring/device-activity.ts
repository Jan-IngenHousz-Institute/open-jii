import type { DeviceFirmwareVersion, DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

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
 * events: connections, firmware transitions, and its registration when that
 * falls inside the window.
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

  return [...lifecycle, ...registration, ...firmwareChanges(monitoring.firmwareHistory)].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

function withinWindow(timestamp: string, fromMs: number, toMs: number): boolean {
  const at = new Date(timestamp).getTime();
  return at >= fromMs && at <= toMs;
}

/**
 * Firmware transitions over the whole window, from the versions the warehouse
 * saw. Each version after the first is a change, recorded when it first
 * appeared; the earliest version is the state the window opened in, not an
 * event.
 */
function firmwareChanges(history: DeviceFirmwareVersion[]): ActivityEntry[] {
  return history.slice(1).map((version, position) => ({
    timestamp: version.firstSeen,
    kind: "firmwareChanged" as const,
    // slice(1) shifts the index, so `position` already addresses the
    // predecessor in the unsliced history.
    detail: `${history[position].version} → ${version.version}`,
  }));
}
