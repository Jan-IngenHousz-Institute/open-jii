import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { DeviceGroupsBlock } from "./device-groups-block";

const group = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Greenhouse B",
  description: "Devices in the east greenhouse.",
  organizationId: null,
  visibility: "private" as const,
  createdBy: "22222222-2222-4222-8222-222222222222",
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z",
  memberCount: 9,
};

describe("DeviceGroupsBlock", () => {
  it("lists groups as rows that link into the group", async () => {
    server.mount(contract.iot.listIotDeviceGroups, { body: [group] });

    render(<DeviceGroupsBlock />);

    const link = await screen.findByRole("link", { name: /Greenhouse B/ });
    expect(link).toHaveAttribute(
      "href",
      "/en-US/platform/devices/groups/11111111-1111-4111-8111-111111111111",
    );
    expect(screen.getByText("Devices in the east greenhouse.")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.memberCount")).toBeInTheDocument();
  });

  it("offers the create tile as the whole grid when there are no groups", async () => {
    server.mount(contract.iot.listIotDeviceGroups, { body: [] });

    render(<DeviceGroupsBlock />);

    // One affordance, in the grid where its result will appear.
    expect(await screen.findByRole("button", { name: "iot.groups.create" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "iot.groups.create" })).toHaveLength(1);
  });

  it("opens the create dialog from the create tile", async () => {
    server.mount(contract.iot.listIotDeviceGroups, { body: [] });
    const user = userEvent.setup();

    render(<DeviceGroupsBlock />);

    await user.click(await screen.findByRole("button", { name: "iot.groups.create" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("surfaces a load failure instead of an empty list", async () => {
    server.mount(contract.iot.listIotDeviceGroups, { status: 500 });

    render(<DeviceGroupsBlock />);

    expect(await screen.findByText("iot.groups.loadError")).toBeInTheDocument();
  });

  it("caps a large estate behind a toggle, create tile always first and visible", async () => {
    const user = userEvent.setup();
    server.mount(contract.iot.listIotDeviceGroups, {
      body: Array.from({ length: 14 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        name: `Group ${String(index)}`,
        description: null,
        memberCount: 0,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      })),
    });

    render(<DeviceGroupsBlock />);

    expect(await screen.findByText("Group 0")).toBeInTheDocument();
    expect(screen.queryByText("Group 12")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "iot.groups.create" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /iot\.groups\.showAll/ }));

    expect(screen.getByText("Group 13")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /iot\.groups\.showFewer/ })).toBeInTheDocument();
  });
});
