import type { Device } from "~/shared/types/device";

const MAC_LIKE = /^([0-9a-f]{2}[:-]){2,}[0-9a-f]{2}$/i;

export function looksLikeMac(value: string): boolean {
  return MAC_LIKE.test(value.trim());
}

export function isNamedDevice(device: Device): boolean {
  const name = device.name.trim();
  return name.length > 0 && !looksLikeMac(name);
}

export function isMultispeqDevice(device: Device): boolean {
  return /multispeq/i.test(device.name);
}

function rank(device: Device): number {
  // A cabled USB/serial device is the most intentional choice, so surface it
  // above any over-the-air device.
  if (device.type === "usb") return 0;
  if (isMultispeqDevice(device)) return 1;
  if (isNamedDevice(device)) return 2;
  return 3;
}

export function sortDevices(devices: Device[]): Device[] {
  return [...devices].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return (b.rssi ?? -Infinity) - (a.rssi ?? -Infinity);
  });
}

/**
 * Adds a device to the list, or refreshes it (name/rssi) if already present, so
 * streamed discovery results dedupe by id+type instead of piling up duplicates.
 */
export function mergeDevice(list: Device[], device: Device): Device[] {
  const i = list.findIndex((d) => d.id === device.id && d.type === device.type);
  if (i === -1) return [...list, device];
  const next = list.slice();
  next[i] = { ...next[i], ...device };
  return next;
}

export function partitionDevices(devices: Device[]): { named: Device[]; unnamed: Device[] } {
  const sorted = sortDevices(devices);
  return {
    named: sorted.filter((d) => rank(d) < 3),
    unnamed: sorted.filter((d) => rank(d) === 3),
  };
}
