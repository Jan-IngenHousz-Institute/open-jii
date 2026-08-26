import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { DevicesOverviewContent } from "./devices-overview-content";

describe("DevicesOverviewContent", () => {
  it("puts devices and groups on one surface, with no section tabs", async () => {
    server.mount(contract.iot.listIotDevices, { body: [] });
    server.mount(contract.iot.listIotDeviceGroups, { body: [] });

    render(<DevicesOverviewContent />);

    // Both blocks are present at once; neither is behind a tab.
    expect(await screen.findByText("iot.devices.sections.groups")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "iot.devices.sections.onboarding" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "iot.devices.sections.monitoring" })).toBeNull();
  });
});
