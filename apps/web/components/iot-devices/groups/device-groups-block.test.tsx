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

  it("offers one inline line when there are no groups, not an empty section", async () => {
    server.mount(contract.iot.listIotDeviceGroups, { body: [] });

    render(<DeviceGroupsBlock />);

    expect(await screen.findByText("iot.groups.emptyHint")).toBeInTheDocument();
    // The header's Create button is suppressed so the empty state owns the CTA.
    expect(screen.getAllByRole("button", { name: "iot.groups.create" })).toHaveLength(1);
  });

  it("opens the create dialog from the empty state", async () => {
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
});
