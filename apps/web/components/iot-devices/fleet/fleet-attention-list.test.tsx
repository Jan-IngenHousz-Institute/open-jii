import { createIotDevice } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { FleetAttentionList } from "./fleet-attention-list";
import type { FleetAttentionEntry } from "./fleet-health";

function entry(overrides: Partial<FleetAttentionEntry> = {}): FleetAttentionEntry {
  return {
    device: createIotDevice(),
    reason: "credentials",
    ...overrides,
  };
}

describe("FleetAttentionList", () => {
  it("says all is well when nothing needs attention", () => {
    render(<FleetAttentionList entries={[]} />);

    expect(screen.getByText("iot.devices.fleet.attentionEmpty")).toBeInTheDocument();
  });

  it("labels each entry with its reason and links to the tab that fixes it", () => {
    const stuck = entry({ reason: "credentials" });
    const silent = entry({ reason: "silent" });
    const unseen = entry({ reason: "neverConnected" });

    render(<FleetAttentionList entries={[stuck, silent, unseen]} />);

    expect(screen.getByText("iot.devices.fleet.reasonCredentials")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.fleet.reasonSilent")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.fleet.reasonNeverConnected")).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    const hrefs = links.map((link) => link.getAttribute("href"));
    expect(hrefs).toContain(`/en-US/platform/devices/${stuck.device.id}/credentials`);
    expect(hrefs).toContain(`/en-US/platform/devices/${silent.device.id}/monitoring`);
    expect(hrefs).toContain(`/en-US/platform/devices/${unseen.device.id}`);
  });

  it("caps the list and counts the overflow instead of drowning the dashboard", () => {
    const entries = Array.from({ length: 8 }, () => entry());

    render(<FleetAttentionList entries={entries} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByText("iot.devices.fleet.attentionMore")).toBeInTheDocument();
  });
});
