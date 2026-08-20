import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { GroupFirmwarePanel } from "./group-firmware-panel";

const DEVICE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEVICE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DEVICE_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SEEN = "2026-08-13T01:00:00.000Z";

const LABELS = new Map([
  [DEVICE_A, "Alpha"],
  [DEVICE_B, "Beta"],
  [DEVICE_C, "Gamma"],
]);

describe("GroupFirmwarePanel", () => {
  it("groups members under their reported version", () => {
    render(
      <GroupFirmwarePanel
        firmware={[
          { deviceId: DEVICE_A, version: "1.0.0", lastSeen: SEEN },
          { deviceId: DEVICE_B, version: "1.0.0", lastSeen: SEEN },
        ]}
        labelByDeviceId={LABELS}
        locale="en-US"
      />,
    );

    expect(screen.getByText("1.0.0")).toBeInTheDocument();
    expect(screen.getByText("Alpha, Beta")).toBeInTheDocument();
    expect(screen.queryByText("iot.groups.monitoring.mixedFirmware")).not.toBeInTheDocument();
  });

  it("warns about a mixed fleet, majority version first", () => {
    render(
      <GroupFirmwarePanel
        firmware={[
          { deviceId: DEVICE_C, version: "2.0.0", lastSeen: SEEN },
          { deviceId: DEVICE_A, version: "1.0.0", lastSeen: SEEN },
          { deviceId: DEVICE_B, version: "1.0.0", lastSeen: SEEN },
        ]}
        labelByDeviceId={LABELS}
        locale="en-US"
      />,
    );

    expect(screen.getByText("iot.groups.monitoring.mixedFirmware")).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("1.0.0");
    expect(rows[1]).toHaveTextContent("2.0.0");
  });

  it("shows the empty state when nothing usable was reported", () => {
    render(
      <GroupFirmwarePanel
        firmware={[
          { deviceId: null, version: "9.9.9", lastSeen: null },
          { deviceId: DEVICE_A, version: null, lastSeen: null },
        ]}
        labelByDeviceId={LABELS}
        locale="en-US"
      />,
    );

    expect(screen.getByText("iot.groups.monitoring.noFirmware")).toBeInTheDocument();
    expect(screen.queryByText("9.9.9")).not.toBeInTheDocument();
  });
});
