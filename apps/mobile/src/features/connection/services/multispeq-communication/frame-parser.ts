export interface MultispeqFrame {
  data: object | string;
  checksum: string;
}

// One frame off the wire, identical for every transport: strip one trailing
// newline if present, split the trailing 8 chars as the CRC checksum, JSON-
// parse the body. Non-JSON bodies degrade to the raw payload (newline
// stripped) with an empty checksum.
export function parseMultispeqFrame(raw: string): MultispeqFrame {
  const payload = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  const checksum = payload.slice(-8);
  const body = payload.slice(0, -8);
  try {
    return { data: JSON.parse(body) as object | string, checksum };
  } catch {
    return { data: payload, checksum: "" };
  }
}
