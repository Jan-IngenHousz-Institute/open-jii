import { createDeviceGroup } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { DeviceGroupsView } from "./device-groups-view";

describe("DeviceGroupsView", () => {
  it("lists groups with their member counts", async () => {
    server.mount(contract.deviceGroups.listDeviceGroups, {
      body: [
        createDeviceGroup({ name: "Greenhouse A", memberCount: 3 }),
        createDeviceGroup({ name: "Field campaign", memberCount: 0 }),
      ],
    });

    render(<DeviceGroupsView />);

    expect(await screen.findByText("Greenhouse A")).toBeInTheDocument();
    expect(screen.getByText("Field campaign")).toBeInTheDocument();
    expect(screen.getAllByText("iot.groups.memberCount")).toHaveLength(2);
  });

  it("shows the empty state when no groups exist", async () => {
    server.mount(contract.deviceGroups.listDeviceGroups, { body: [] });

    render(<DeviceGroupsView />);

    expect(await screen.findByText("iot.groups.emptyTitle")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.create")).toBeInTheDocument();
  });
});
