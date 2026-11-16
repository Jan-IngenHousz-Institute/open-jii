import { describe, expect, it } from "vitest";

import { bufferStartOf, dayPrefixes } from "./ingest-replay-archive.js";

describe("dayPrefixes", () => {
  it("covers every UTC day the window touches", () => {
    expect(
      dayPrefixes("raw-iot", new Date("2026-10-30T23:00:00Z"), new Date("2026-11-01T01:00:00Z")),
    ).toEqual(["raw-iot/2026/10/30/", "raw-iot/2026/10/31/", "raw-iot/2026/11/01/"]);
  });
});

describe("bufferStartOf", () => {
  it("reads the time in a Firehose object's name as UTC", () => {
    expect(
      bufferStartOf(
        "raw-iot/2026/11/15/open-jii-dev-iot-raw-archive-2-2026-11-15-00-04-47-b5a680c7-7f9b-4947-8e83-a1c352dbd223.gz",
      ),
    ).toEqual(new Date("2026-11-15T00:04:47Z"));
  });

  it("finds no time in any other name", () => {
    expect(bufferStartOf("raw-iot/2026/10/07/a.gz")).toBeNull();
    expect(bufferStartOf("iot-rule-errors/2026/10/07/12/some-error-object")).toBeNull();
  });
});
