import { describe, expect, it } from "vitest";

import type { ArchiveObject } from "./aws.js";
import { bufferStartOf, dayPrefixes, windowObjects } from "./ingest-replay-archive.js";

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

describe("windowObjects", () => {
  it("keeps the matching and late objects from a busy day's listing", async () => {
    const prefix = "raw-iot/2026/08/19/";
    const tooEarly: ArchiveObject = {
      key: `${prefix}early.gz`,
      lastModified: new Date("2026-08-19T01:00:00Z"),
      storageClass: "STANDARD",
      restoredUntil: null,
    };
    const onTime: ArchiveObject = {
      ...tooEarly,
      key: `${prefix}on-time.gz`,
      lastModified: new Date("2026-08-19T13:30:00Z"),
    };
    const late: ArchiveObject = {
      ...tooEarly,
      key: `${prefix}archive-2-2026-08-19-13-17-55-b5a680c7-7f9b-4947-8e83-a1c352dbd223.gz`,
      lastModified: new Date("2026-08-20T01:00:00Z"),
    };
    const listed = Array.from({ length: 150_000 }, (_, index) => ({
      ...tooEarly,
      key: `${prefix}early-${index}.gz`,
    }));
    listed.push(onTime, late);

    const result = await windowObjects(
      {
        source: "archive",
        from: new Date("2026-08-19T13:17:54Z"),
        to: new Date("2026-08-19T13:17:56Z"),
      },
      {
        list: (requestedPrefix) => Promise.resolve(requestedPrefix === prefix ? listed : []),
        read: () => Promise.resolve(""),
      },
    );

    expect(result).toEqual({ objects: [onTime, late], late: [late.key] });
  });
});
