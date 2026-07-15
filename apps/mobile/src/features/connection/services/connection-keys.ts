// Canonical react-query keys for device connectivity. Every consumer
// (hooks, lifecycle subscriber, invalidations) goes through this builder.
export const connectionKeys = {
  // Holds Device[]: every connected device in connect order; the first entry
  // is the Primary device (see CONTEXT.md). Single-device consumers derive
  // their Device | null view via select.
  connectedDevices: ["connected-devices"] as const,
  allDevices: ["all-devices"] as const,
  battery: (deviceId: string | undefined) => ["device", deviceId, "battery"] as const,
} as const;
