import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { parseBulkBatch } from "./bulk-register-parse";
import { BulkRegisterPreview } from "./bulk-register-preview";

describe("BulkRegisterPreview", () => {
  it("shows one classified row per pasted line", () => {
    const batch = parseBulkBatch("S-1, North gate\nS-1\nnot a serial!!\nS-2", new Set(["S-2"]));

    render(<BulkRegisterPreview batch={batch} />);

    expect(screen.getByText("iot.devices.bulkDialog.status.ready")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.bulkDialog.status.duplicate")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.bulkDialog.status.invalid")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.bulkDialog.status.registered")).toBeInTheDocument();
    expect(screen.getByText("North gate")).toBeInTheDocument();
    // The invalid row shows the raw line, so the typo stays visible.
    expect(screen.getByText("not a serial!!")).toBeInTheDocument();
  });
});
