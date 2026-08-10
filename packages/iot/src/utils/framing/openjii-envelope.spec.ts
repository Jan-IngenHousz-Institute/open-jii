import { describe, it, expect } from "vitest";

import {
  OPENJII_FRAME_FOOTER,
  parseOpenJiiEnvelope,
  parseOpenJiiTopLevelError,
} from "./openjii-envelope";

const ENVELOPE = '{"device_name":"Ambit","sample":[{"protocol_id":"NaN","set":[{"s_630":[1]}]}]}';

describe("parseOpenJiiEnvelope", () => {
  it("strips the footer and parses the envelope", () => {
    const parsed = parseOpenJiiEnvelope(`${ENVELOPE}${OPENJII_FRAME_FOOTER}\n`);
    expect(parsed?.device_name).toBe("Ambit");
    expect(parsed?.sample).toHaveLength(1);
  });

  it("returns null while the footer has not arrived", () => {
    expect(parseOpenJiiEnvelope(ENVELOPE)).toBeNull();
  });

  it("returns null when the footer is present but the JSON is corrupt", () => {
    expect(parseOpenJiiEnvelope(`{"sample":[${OPENJII_FRAME_FOOTER}`)).toBeNull();
  });
});

describe("parseOpenJiiTopLevelError", () => {
  it("matches a complete footer-less error line", () => {
    expect(parseOpenJiiTopLevelError('{"error":"json_parse","detail":"InvalidInput"}\n')).toBe(
      "json_parse",
    );
  });

  it("ignores an envelope carrying inline error objects", () => {
    const inline = `{"sample":[{"set":[{"error":"bad_arrun"}]}]}${OPENJII_FRAME_FOOTER}\n`;
    expect(parseOpenJiiTopLevelError(inline)).toBeNull();
  });

  it("returns null for an incomplete error line", () => {
    expect(parseOpenJiiTopLevelError('{"error":"rx_over')).toBeNull();
  });
});
