export interface ExperimentDevicesSummary {
  total: number;
  onboarded: number;
  sending: number;
  onboardedSilent: number;
  sendingUnbound: number;
}

/** The tab's four tiles. "Sending" means data landed in the overview's window. */
export function summarizeExperimentDevices(
  devices: readonly { binding: object | null; recentData: object | null }[],
): ExperimentDevicesSummary {
  let onboarded = 0;
  let sending = 0;
  let onboardedSilent = 0;
  let sendingUnbound = 0;

  for (const entry of devices) {
    const isBound = entry.binding !== null;
    const isSending = entry.recentData !== null;
    if (isBound) onboarded += 1;
    if (isSending) sending += 1;
    if (isBound && !isSending) onboardedSilent += 1;
    if (!isBound && isSending) sendingUnbound += 1;
  }

  return { total: devices.length, onboarded, sending, onboardedSilent, sendingUnbound };
}
