import { createDeviceGroupDetail } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { useParams } from "next/navigation";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import DeviceGroupLayout from "../layout";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

function renderLayout(children: React.ReactNode = <div>Child Content</div>) {
  vi.mocked(useParams).mockReturnValue({ groupId: GROUP_ID });
  return render(<DeviceGroupLayout>{children}</DeviceGroupLayout>);
}

const tabHref = (name: string) => screen.getByRole("tab", { name }).getAttribute("href");

describe("<DeviceGroupLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the group header and a route-linked strip once loaded", async () => {
    server.mount(contract.deviceGroups.getDeviceGroup, {
      body: createDeviceGroupDetail({
        id: GROUP_ID,
        name: "Greenhouse A",
        description: "The field fleet.",
        memberCount: 3,
      }),
    });

    renderLayout();

    expect(await screen.findByRole("heading", { name: "Greenhouse A" })).toBeInTheDocument();
    expect(screen.getByText("The field fleet.")).toBeInTheDocument();
    expect(tabHref("iot.devices.detailTabs.overview")).toBe(
      `/en-US/platform/devices/groups/${GROUP_ID}`,
    );
    expect(tabHref("iot.devices.detailTabs.collaborators")).toBe(
      `/en-US/platform/devices/groups/${GROUP_ID}/collaborators`,
    );
    expect(tabHref("iot.devices.detailTabs.monitoring")).toBe(
      `/en-US/platform/devices/groups/${GROUP_ID}/monitoring`,
    );
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("shows the load error when the group is inaccessible", async () => {
    server.mount(contract.deviceGroups.getDeviceGroup, { status: 403 });

    renderLayout();

    expect(await screen.findByText("iot.groups.loadError")).toBeInTheDocument();
  });
});
