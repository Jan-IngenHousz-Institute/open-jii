import { render, screen } from "@/test/test-utils";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { DeviceGroupDetailTabs } from "./device-group-detail-tabs";

function renderTabs(caps: { canShare?: boolean; canLeave?: boolean; canManage?: boolean } = {}) {
  render(
    <DeviceGroupDetailTabs
      groupId="g-1"
      canShare={caps.canShare ?? true}
      canLeave={caps.canLeave ?? false}
      canManage={caps.canManage ?? true}
    >
      <p>tab body</p>
    </DeviceGroupDetailTabs>,
  );
}

describe("DeviceGroupDetailTabs", () => {
  it("mirrors the device tab strip, minus lineage", () => {
    renderTabs();

    for (const tab of ["overview", "credentials", "onboarding", "collaborators", "monitoring"]) {
      expect(screen.getByText(`iot.devices.detailTabs.${tab}`)).toBeInTheDocument();
    }
    expect(screen.queryByText("iot.devices.detailTabs.lineage")).not.toBeInTheDocument();
  });

  it("hides credentials without manage and collaborators without share or leave", () => {
    renderTabs({ canShare: false, canLeave: false, canManage: false });

    expect(screen.queryByText("iot.devices.detailTabs.credentials")).not.toBeInTheDocument();
    expect(screen.queryByText("iot.devices.detailTabs.collaborators")).not.toBeInTheDocument();
    expect(screen.getByText("iot.devices.detailTabs.monitoring")).toBeInTheDocument();
  });

  it("highlights no tab when the active route is filtered out", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/devices/groups/g-1/credentials");
    renderTabs({ canManage: false });

    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveAttribute("aria-selected", "false");
    }
  });
});
