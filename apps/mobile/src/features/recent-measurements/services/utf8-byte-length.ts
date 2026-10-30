// The broker counts UTF-8 bytes while a JS string counts UTF-16 code units, so
// a measurement carrying non-ASCII comments would measure short and be refused
// on the wire instead of routed to S3.
export function utf8ByteLength(value: string): number {
  let bytes = 0;

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // Lead surrogate: the pair encodes to four bytes, so skip its tail.
      bytes += 4;
      i++;
    } else {
      bytes += 3;
    }
  }

  return bytes;
}
