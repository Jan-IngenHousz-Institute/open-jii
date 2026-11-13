/**
 * Thing attribute the device-location IoT policy binds through
 * `${iot:Connection.Thing.Attributes[deviceLocationId]}`. The name is repeated
 * in infrastructure/modules/iot-core/main.tf and must change in both places.
 */
export const DEVICE_LOCATION_ID_ATTRIBUTE = "deviceLocationId";

/**
 * Longest id we hand out. AWS accepted 200 characters in a dev test; the cap
 * is ours, and an id over it is refused rather than truncated, since a
 * truncated id could equal another device's.
 */
export const DEVICE_LOCATION_ID_MAX_LENGTH = 128;

const PLAIN = /^[A-Za-z0-9]$/;

/**
 * The id a device uses in `$aws/device_location/{id}/get_position_estimate`,
 * where AWS accepts only letters, digits and dashes. Every UTF-8 byte outside
 * [A-Za-z0-9], the dash included, becomes `-` plus two uppercase hex digits,
 * so the encoding is reversible: two thing names never share an id, and
 * neither do the policy grants bound to it. Firmware derives the same id from
 * its own thing name, so this is a device contract. Null when the thing name
 * is empty or its id would exceed {@link DEVICE_LOCATION_ID_MAX_LENGTH}.
 */
export function toDeviceLocationId(thingName: string): string | null {
  let id = "";
  for (const char of thingName) {
    if (PLAIN.test(char)) {
      id += char;
      continue;
    }
    for (const byte of Buffer.from(char, "utf8")) {
      id += `-${byte.toString(16).toUpperCase().padStart(2, "0")}`;
    }
  }
  return id.length > 0 && id.length <= DEVICE_LOCATION_ID_MAX_LENGTH ? id : null;
}

/** Inverse of {@link toDeviceLocationId}; null for a string it cannot have produced. */
export function fromDeviceLocationId(id: string): string | null {
  if (!/^(?:[A-Za-z0-9]|-[0-9A-F]{2})+$/.test(id)) return null;
  const bytes: number[] = [];
  for (let index = 0; index < id.length; index++) {
    if (id[index] === "-") {
      bytes.push(parseInt(id.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(id.charCodeAt(index));
    }
  }
  const thingName = Buffer.from(bytes).toString("utf8");
  // Rejects escapes of plain characters and byte runs that are not UTF-8.
  return toDeviceLocationId(thingName) === id ? thingName : null;
}
