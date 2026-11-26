/**
 * The AWS IoT thing name a device has, or will have once credentials are issued:
 * `<family>_<serial>` with characters AWS refuses replaced by `-`.
 */
export function buildThingName(deviceType: string, serialNumber: string): string {
  const safeType = deviceType.replace(/[^a-zA-Z0-9:_-]/g, "-");
  const safeSerial = serialNumber.replace(/[^a-zA-Z0-9:_-]/g, "-");
  return `${safeType}_${safeSerial}`;
}
