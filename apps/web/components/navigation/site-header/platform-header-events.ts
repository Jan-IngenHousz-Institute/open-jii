export const OPEN_WORKBOOK_CREATE_EVENT = "openjii:create-workbook";
export const OPEN_DEVICE_REGISTER_EVENT = "openjii:register-device";
export const OPEN_DEVICE_BULK_REGISTER_EVENT = "openjii:bulk-register-devices";

export type PlatformHeaderEvent =
  | typeof OPEN_WORKBOOK_CREATE_EVENT
  | typeof OPEN_DEVICE_REGISTER_EVENT
  | typeof OPEN_DEVICE_BULK_REGISTER_EVENT;
