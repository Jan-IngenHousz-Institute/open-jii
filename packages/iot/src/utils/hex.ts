/**
 * Hex encoding/decoding utilities for serial communication
 */

/** Convert string to hex string */
export function toHex(data: string): string {
  return Array.from(data)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Convert hex string to regular string */
export function fromHex(hex: string): string {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string: length must be even");
  }

  let result = "";
  for (let i = 0; i < hex.length; i += 2) {
    const byte = hex.slice(i, i + 2);
    result += String.fromCharCode(parseInt(byte, 16));
  }

  return result;
}
