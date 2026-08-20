import { createDeviceGroupMemberHealth } from "@/test/factories";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type {
  DeviceGroupMemberHealth,
  DeviceGroupMonitoring,
} from "@repo/api/domains/device-group/device-group.schema";

import { GroupDevicesTable } from "./group-devices-table";

const NOW = Date.now();
const STALE = new Date(NOW - 3 * 3_600_000).toISOString();
const RECENT = new Date(NOW - 30 * 60_000).toISOString();

const online = { connected: true, lastSeenAt: null };

function monitoringWith(
  members: DeviceGroupMemberHealth[],
  pipelineUnavailable = false,
): DeviceGroupMonitoring {
  return {
    members,
    throughput: [],
    dataByExperiment: [],
    firmware: [],
    events: [],
    pipelineUnavailable,
  };
}

interface TableSetup {
  members: DeviceGroupMemberHealth[];
  labels?: Map<string, string>;
  versions?: Map<string, string>;
  pipelineUnavailable?: boolean;
}

function renderTable({
  members,
  labels = new Map(),
  versions = new Map(),
  pipelineUnavailable = false,
}: TableSetup) {
  return render(
    <GroupDevicesTable
      monitoring={monitoringWith(members, pipelineUnavailable)}
      members={members}
      labelByDeviceId={labels}
      versionByDeviceId={versions}
      locale="en-US"
      now={NOW}
    />,
  );
}

describe("GroupDevicesTable", () => {
  it("links each member to its own monitoring dashboard, falling back to the serial", () => {
    const labeled = createDeviceGroupMemberHealth({ name: "Gateway One" });
    const bare = createDeviceGroupMemberHealth({ name: null, serialNumber: "BB:22" });

    renderTable({
      members: [labeled, bare],
      labels: new Map([[labeled.deviceId, "Gateway One"]]),
    });

    expect(screen.getByRole("link", { name: "Gateway One" })).toHaveAttribute(
      "href",
      `/en-US/platform/devices/${labeled.deviceId}/monitoring`,
    );
    expect(screen.getByRole("link", { name: "BB:22" })).toHaveAttribute(
      "href",
      `/en-US/platform/devices/${bare.deviceId}/monitoring`,
    );
  });

  it("flags only the connected member that stopped delivering", () => {
    renderTable({
      members: [
        createDeviceGroupMemberHealth({ connectivity: online, lastDataAt: STALE }),
        createDeviceGroupMemberHealth({ connectivity: online, lastDataAt: RECENT }),
      ],
    });

    expect(screen.getAllByText("iot.devices.monitoring.connectedButSilent")).toHaveLength(1);
  });

  it("reports last data as unavailable while the pipeline is down", () => {
    renderTable({
      members: [createDeviceGroupMemberHealth({ connectivity: online, lastDataAt: null })],
      pipelineUnavailable: true,
    });

    expect(screen.getByText("iot.devices.monitoring.lastDataUnavailable")).toBeInTheDocument();
    expect(screen.queryByText("iot.devices.monitoring.connectedButSilent")).not.toBeInTheDocument();
  });

  it("shows the firmware column only when a version is known", () => {
    const member = createDeviceGroupMemberHealth();

    const { unmount } = renderTable({ members: [member] });
    expect(screen.queryByText("iot.groups.monitoring.versionColumn")).not.toBeInTheDocument();
    unmount();

    renderTable({ members: [member], versions: new Map([[member.deviceId, "1.2.3"]]) });
    expect(screen.getByText("iot.groups.monitoring.versionColumn")).toBeInTheDocument();
    expect(screen.getByText("1.2.3")).toBeInTheDocument();
  });

  it("shows the no-matches message when the filter empties the roster", () => {
    render(
      <GroupDevicesTable
        monitoring={monitoringWith([createDeviceGroupMemberHealth()])}
        members={[]}
        labelByDeviceId={new Map()}
        versionByDeviceId={new Map()}
        locale="en-US"
        now={NOW}
      />,
    );

    expect(screen.getByText("iot.groups.monitoring.filter.noMatches")).toBeInTheDocument();
  });

  it("opens the device's dashboard from anywhere on the row", async () => {
    const user = userEvent.setup();
    const member = createDeviceGroupMemberHealth({ name: "Gateway", connectivity: online });
    const { router } = render(
      <GroupDevicesTable
        monitoring={monitoringWith([member])}
        members={[member]}
        labelByDeviceId={new Map([[member.deviceId, "Gateway"]])}
        versionByDeviceId={new Map()}
        locale="en-US"
        now={NOW}
      />,
    );

    await user.click(screen.getByText("iot.devices.connectivity.connected"));

    expect(router.push).toHaveBeenCalledWith(
      `/en-US/platform/devices/${member.deviceId}/monitoring`,
    );
  });
});
