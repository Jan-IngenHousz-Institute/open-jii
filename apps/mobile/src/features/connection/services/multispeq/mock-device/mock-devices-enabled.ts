// Dev-only escape hatch: surfaces fake multi-connectable devices so the
// multi-scan UI can be exercised without a USB hub full of hardware.
export const mockDevicesEnabled = __DEV__ && process.env.EXPO_PUBLIC_ENABLE_MOCK_DEVICES === "true";
