import { describe, expect, it } from "vitest";
import type { Device } from "~/shared/types/device";

import { partitionScanOutcomes } from "./partition-scan-outcomes";

const deviceA: Device = { id: "a", type: "usb", name: "MultispeQ A" };
const deviceB: Device = { id: "b", type: "usb", name: "MultispeQ B" };

describe("partitionScanOutcomes", () => {
  it("splits fulfilled and rejected outcomes per device", () => {
    const { successes, failures } = partitionScanOutcomes([
      { device: deviceA, status: "fulfilled", result: { sample: [1] } },
      { device: deviceB, status: "rejected", error: new Error("unplugged") },
    ]);

    expect(successes).toEqual([{ device: deviceA, result: { sample: [1] } }]);
    expect(failures).toEqual([{ device: deviceB, error: new Error("unplugged") }]);
  });

  it("treats a non-object reply as a failure (Invalid result)", () => {
    const { successes, failures } = partitionScanOutcomes([
      { device: deviceA, status: "fulfilled", result: "ok" },
    ]);

    expect(successes).toEqual([]);
    expect(failures).toHaveLength(1);
    expect(failures[0].error.message).toBe("Invalid result");
  });

  it("returns empty partitions for no outcomes", () => {
    expect(partitionScanOutcomes([])).toEqual({ successes: [], failures: [] });
  });
});
