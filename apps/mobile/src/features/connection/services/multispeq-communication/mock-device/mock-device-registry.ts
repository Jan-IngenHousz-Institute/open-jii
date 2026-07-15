import type { Device } from "~/shared/types/device";

// Mirrors the serial Device registry surface (open/close/list) for
// "mock-device" entries, so connection hooks treat mocks like real ports.
const connectedMockDevices = new Map<string, Device>();

export function openMockDevice(device: Device) {
  connectedMockDevices.set(device.id, device);
}

export function closeMockDevice(deviceId: string) {
  connectedMockDevices.delete(deviceId);
}

export function closeAllMockDevices() {
  connectedMockDevices.clear();
}

export function getConnectedMockDevices(): Device[] {
  return Array.from(connectedMockDevices.values());
}
