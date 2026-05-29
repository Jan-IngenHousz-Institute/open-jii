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
  if (isMultispeqDevice(device)) return 0;
  if (isNamedDevice(device)) return 1;
  return 2;
}

export function sortDevices(devices: Device[]): Device[] {
  return [...devices].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return (b.rssi ?? -Infinity) - (a.rssi ?? -Infinity);
  });
}

export function partitionDevices(devices: Device[]): { named: Device[]; unnamed: Device[] } {
  const sorted = sortDevices(devices);
  return {
    named: sorted.filter((d) => rank(d) < 2),
    unnamed: sorted.filter((d) => rank(d) === 2),
  };
}
