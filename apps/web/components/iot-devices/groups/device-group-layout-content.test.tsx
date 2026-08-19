import { createDeviceGroupDetail } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DeviceGroupDetail } from "@repo/api/domains/device-group/device-group.schema";

import { DeviceGroupLayoutContent } from "./device-group-layout-content";

function renderLayout(group: DeviceGroupDetail) {
  render(
    <DeviceGroupLayoutContent groupId="g-1" group={group}>
      <p>tab body</p>
    </DeviceGroupLayoutContent>,
  );
}

describe("DeviceGroupLayoutContent", () => {
  it("renders the back link, heading, description, and children", () => {
    renderLayout(createDeviceGroupDetail({ name: "Greenhouse A", description: "North wing" }));

    const backLink = screen.getByText("iot.groups.backToDevices").closest("a");
    expect(backLink).toHaveAttribute("href", "/en-US/platform/devices");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Greenhouse A");
    expect(screen.getByText("North wing")).toBeInTheDocument();
    expect(screen.getByText("tab body")).toBeInTheDocument();
  });

  it("omits the description paragraph when there is none", () => {
    renderLayout(createDeviceGroupDetail({ name: "Field campaign", description: null }));

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.parentElement?.querySelectorAll("p")).toHaveLength(0);
  });
});
