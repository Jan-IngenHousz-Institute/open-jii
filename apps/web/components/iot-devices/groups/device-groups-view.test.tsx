import { createIotDeviceGroup } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { DeviceGroupsView } from "./device-groups-view";

describe("DeviceGroupsView", () => {
  it("opens the create dialog from the section header", async () => {
    const user = userEvent.setup();
    server.mount(contract.iot.listIotDeviceGroups, { body: [] });

    render(<DeviceGroupsView />);

    await user.click(await screen.findByText("iot.groups.create"));
    expect(await screen.findByText("iot.groups.createTitle")).toBeInTheDocument();
  });

  it("surfaces a load error", async () => {
    server.mount(contract.iot.listIotDeviceGroups, { status: 500 });

    render(<DeviceGroupsView />);

    expect(await screen.findByText("iot.groups.loadError")).toBeInTheDocument();
  });

  it("lists groups with their member counts", async () => {
    server.mount(contract.iot.listIotDeviceGroups, {
      body: [
        createIotDeviceGroup({ name: "Greenhouse A", memberCount: 3 }),
        createIotDeviceGroup({ name: "Field campaign", memberCount: 0 }),
      ],
    });

    render(<DeviceGroupsView />);

    expect(await screen.findByText("Greenhouse A")).toBeInTheDocument();
    expect(screen.getByText("Field campaign")).toBeInTheDocument();
    expect(screen.getAllByText("iot.groups.memberCount")).toHaveLength(2);
  });

  it("shows the empty state when no groups exist", async () => {
    server.mount(contract.iot.listIotDeviceGroups, { body: [] });

    render(<DeviceGroupsView />);

    expect(await screen.findByText("iot.groups.emptyTitle")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.create")).toBeInTheDocument();
  });
});
