// Canonical react-query keys for device connectivity. Every consumer
// (hooks, lifecycle subscriber, invalidations) goes through this builder.
export const connectionKeys = {
  connectedDevice: ["connected-device"] as const,
  allDevices: ["all-devices"] as const,
  battery: (deviceId: string | undefined) => ["device", deviceId, "battery"] as const,
} as const;
