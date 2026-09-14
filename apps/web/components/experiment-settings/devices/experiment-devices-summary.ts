import type { ExperimentDevicesOverview } from "@repo/api/domains/experiment/devices/experiment-devices.schema";

export interface ExperimentDevicesSummary {
  onboarded: number;
  sending: number;
  onboardedSilent: number;
  sendingUnbound: number;
}

/** The tab's four tiles. "Sending" means data landed in the overview's window. */
export function summarizeExperimentDevices(
  overview: ExperimentDevicesOverview,
): ExperimentDevicesSummary {
  let onboarded = 0;
  let sending = 0;
  let onboardedSilent = 0;
  let sendingUnbound = 0;

  for (const entry of overview.devices) {
    const isBound = entry.binding !== null;
    const isSending = entry.recentData !== null;
    if (isBound) onboarded += 1;
    if (isSending) sending += 1;
    if (isBound && !isSending) onboardedSilent += 1;
    if (!isBound && isSending) sendingUnbound += 1;
  }

  return { onboarded, sending, onboardedSilent, sendingUnbound };
}
