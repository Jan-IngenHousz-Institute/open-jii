import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { DevicesSectionTabs } from "./devices-section-tabs";

vi.mock("./iot-devices-table-view", () => ({
  IotDevicesTableView: () => <div data-testid="devices-table-view" />,
}));

describe("DevicesSectionTabs", () => {
  it("shows the devices list by default and stubs future sections", async () => {
    const user = userEvent.setup();
    render(<DevicesSectionTabs />);

    expect(screen.getByTestId("devices-table-view")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "iot.devices.sections.groups" }));
    expect(await screen.findByText("iot.devices.comingSoon.title")).toBeInTheDocument();
  });
});
