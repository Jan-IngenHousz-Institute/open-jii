/**
 * Utility functions for data framing and parsing
 */

/** Convert object to JSON string if it's an object, otherwise return as-is */
export function stringifyIfObject(data: string | object): string {
  if (typeof data === "string") {
    return data;
  }
  return JSON.stringify(data);
}

/** Parse JSON string, return original if parsing fails */
export function tryParseJson<T = unknown>(data: string): T | string {
  try {
    return JSON.parse(data) as T;
  } catch {
    return data;
  }
}

/** Extract checksum from end of data string */
export function extractChecksum(
  data: string,
  checksumLength: number,
): { data: string; checksum: string } {
  if (data.length < checksumLength) {
    return { data, checksum: "" };
  }

  return {
    data: data.slice(0, -checksumLength),
    checksum: data.slice(-checksumLength),
  };
}

/** Add line ending to command */
export function addLineEnding(command: string, ending = "\r\n"): string {
  return command + ending;
}

/** Remove line ending from data */
export function removeLineEnding(data: string): string {
  return data.replace(/\r?\n$/, "");
}
