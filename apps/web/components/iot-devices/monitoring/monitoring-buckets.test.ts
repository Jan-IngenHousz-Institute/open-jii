import { describe, expect, it } from "vitest";

import { bucketAxis, formatBucketLabel } from "./monitoring-buckets";

describe("bucketAxis", () => {
  it("zero-fills every hour bucket across the range, boundaries included", () => {
    const axis = bucketAxis("2026-08-13T00:00:00.000Z", "2026-08-13T12:00:00.000Z", "hour");

    expect(axis).toHaveLength(13);
    expect(axis[0]).toBe("2026-08-13T00:00:00.000Z");
    expect(axis[12]).toBe("2026-08-13T12:00:00.000Z");
  });

  it("floors a mid-bucket range start to its bucket boundary", () => {
    const axis = bucketAxis("2026-08-13T00:30:00.000Z", "2026-08-13T02:00:00.000Z", "hour");

    expect(axis[0]).toBe("2026-08-13T00:00:00.000Z");
    expect(axis).toHaveLength(3);
  });

  it("steps by whole days for day buckets", () => {
    const axis = bucketAxis("2026-08-10T00:00:00.000Z", "2026-08-13T00:00:00.000Z", "day");

    expect(axis).toHaveLength(4);
    expect(axis[3]).toBe("2026-08-13T00:00:00.000Z");
  });
});

describe("formatBucketLabel", () => {
  it("labels a day bucket with its UTC date regardless of the viewer timezone", () => {
    // A UTC midnight rendered locally would read as the previous day anywhere
    // west of UTC; the label must stay on the UTC day.
    expect(formatBucketLabel("2026-08-13T00:00:00.000Z", "day")).toBe("Aug 13");
  });

  it("labels an hour bucket as a localized instant", () => {
    expect(formatBucketLabel("2026-08-13T14:00:00.000Z", "hour")).toMatch(
      /^[A-Z][a-z]{2} \d{1,2} \d{2}:\d{2}$/,
    );
  });
});
