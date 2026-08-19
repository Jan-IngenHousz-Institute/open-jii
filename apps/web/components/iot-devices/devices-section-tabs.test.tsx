import { server } from "@/test/msw/server";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { DevicesSectionTabs } from "./devices-section-tabs";

vi.mock("./iot-devices-table-view", () => ({
  IotDevicesTableView: () => <div data-testid="devices-table-view" />,
}));

describe("DevicesSectionTabs", () => {
  it("shows the devices list by default and opens the groups section", async () => {
    const user = userEvent.setup();
    server.mount(contract.deviceGroups.listDeviceGroups, { body: [] });
    render(<DevicesSectionTabs />);

    expect(screen.getByTestId("devices-table-view")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "iot.devices.sections.groups" }));
    expect(await screen.findByText("iot.groups.create")).toBeInTheDocument();
  });
});
