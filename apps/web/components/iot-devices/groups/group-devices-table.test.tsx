import type { MonitoringRange } from "@/components/iot-devices/monitoring/monitoring-range";
import { createDeviceGroupMemberHealth } from "@/test/factories";
import { openOnUrl } from "@/test/list-request";
import { act, render, renderHook, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type {
  IotDeviceGroupMemberHealth,
  IotDeviceGroupMonitoring,
} from "@repo/api/domains/iot/device-group/iot-device-group.schema";

import { GroupDevicesTable } from "./group-devices-table";
import { GroupMonitoringFilter } from "./group-monitoring-filter";
import { useGroupDevicesList } from "./use-group-devices-list";

const NOW = Date.now();
const RANGE: MonitoringRange = {
  from: "2026-11-18T00:00:00.000Z",
  to: "2026-11-19T00:00:00.000Z",
  bucket: "hour",
};
const STALE = new Date(NOW - 3 * 3_600_000).toISOString();
const RECENT = new Date(NOW - 30 * 60_000).toISOString();

const online = { connected: true, lastSeenAt: null };

function monitoringWith(
  members: IotDeviceGroupMemberHealth[],
  pipelineUnavailable = false,
): IotDeviceGroupMonitoring {
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
  members: IotDeviceGroupMemberHealth[];
  labels?: Map<string, string>;
  versions?: Map<string, string>;
  pipelineUnavailable?: boolean;
  dataUpdatedAt?: number;
  range?: MonitoringRange;
}

function DeviceTable({
  members,
  labels = new Map(),
  versions = new Map(),
  pipelineUnavailable = false,
  dataUpdatedAt = 1,
  range = RANGE,
}: TableSetup) {
  const list = useGroupDevicesList({
    groupId: "group",
    range,
    dataUpdatedAt,
    members,
    labelByDeviceId: labels,
    pipelineUnavailable,
    now: NOW,
  });
  return (
    <>
      <GroupMonitoringFilter list={list} />
      <GroupDevicesTable
        monitoring={monitoringWith(members, pipelineUnavailable)}
        members={list.data?.items ?? []}
        labelByDeviceId={labels}
        versionByDeviceId={versions}
        locale="en-US"
        now={NOW}
        list={list}
      />
    </>
  );
}

function renderTable(props: TableSetup) {
  return render(<DeviceTable {...props} />);
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
    openOnUrl("/platform/devices/groups/group/monitoring", "q=unmatched");
    renderTable({ members: [createDeviceGroupMemberHealth({ serialNumber: "AA:11" })] });

    expect(screen.getByText("iot.groups.monitoring.filter.noMatches")).toBeInTheDocument();
  });

  it("sorts health in the filter menu order ascending and descending", async () => {
    const user = userEvent.setup();
    const members = [
      createDeviceGroupMemberHealth({
        serialNumber: "Silent",
        connectivity: online,
        lastDataAt: STALE,
      }),
      createDeviceGroupMemberHealth({ serialNumber: "Unknown", connectivity: null }),
      createDeviceGroupMemberHealth({
        serialNumber: "Offline",
        connectivity: { connected: false, lastSeenAt: null },
      }),
      createDeviceGroupMemberHealth({
        serialNumber: "Online",
        connectivity: online,
        lastDataAt: RECENT,
      }),
    ];
    renderTable({ members });
    await user.click(screen.getByRole("button", { name: /iot.groups.monitoring.stateColumn:/ }));
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Online",
      "Offline",
      "Unknown",
      "Silent",
    ]);
    await user.click(screen.getByRole("button", { name: /iot.groups.monitoring.stateColumn:/ }));
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Silent",
      "Unknown",
      "Offline",
      "Online",
    ]);
  });

  it("sorts family by its stored value ascending and descending", async () => {
    const user = userEvent.setup();
    renderTable({
      members: [
        createDeviceGroupMemberHealth({ serialNumber: "Mobile", deviceType: "mobile" }),
        createDeviceGroupMemberHealth({ serialNumber: "Ambyte", deviceType: "ambyte" }),
        createDeviceGroupMemberHealth({ serialNumber: "Ambit", deviceType: "ambit" }),
      ],
    });
    await user.click(screen.getByRole("button", { name: /iot.devices.columns.family:/ }));
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Ambit",
      "Ambyte",
      "Mobile",
    ]);
    await user.click(screen.getByRole("button", { name: /iot.devices.columns.family:/ }));
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Mobile",
      "Ambyte",
      "Ambit",
    ]);
  });

  it("uses Shift-click family sorting to break health ties", async () => {
    const user = userEvent.setup();
    renderTable({
      members: [
        createDeviceGroupMemberHealth({
          serialNumber: "Mobile online",
          deviceType: "mobile",
          connectivity: online,
        }),
        createDeviceGroupMemberHealth({
          serialNumber: "Ambit unknown",
          deviceType: "ambit",
          connectivity: null,
        }),
        createDeviceGroupMemberHealth({
          serialNumber: "Ambit online",
          deviceType: "ambit",
          connectivity: online,
        }),
      ],
      pipelineUnavailable: true,
    });
    await user.click(screen.getByRole("button", { name: /iot.groups.monitoring.stateColumn:/ }));
    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("button", { name: /iot.devices.columns.family:/ }));
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Ambit online",
      "Mobile online",
      "Ambit unknown",
    ]);
    expect(
      screen.getByRole("button", { name: /iot.devices.columns.family:/ }),
    ).toHaveAccessibleName(
      "iot.devices.columns.family: common.sortAscending, common.sortSecondary",
    );
    await user.click(screen.getByRole("button", { name: /iot.devices.columns.family:/ }));
    await user.keyboard("{/Shift}");
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Mobile online",
      "Ambit online",
      "Ambit unknown",
    ]);
  });

  it("clears health, family and search from the zero-results action", async () => {
    const user = userEvent.setup();
    openOnUrl(
      "/platform/devices/groups/group/monitoring",
      "groupHealth=offline&deviceFamily=mobile&q=missing",
    );
    renderTable({
      members: [createDeviceGroupMemberHealth({ serialNumber: "AA:11", connectivity: null })],
    });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "common.clearFilters" })[1]);
    expect(
      screen.getByPlaceholderText("iot.groups.monitoring.filter.searchPlaceholder"),
    ).toHaveValue("");
    await waitFor(() => expect(screen.getByRole("link", { name: "AA:11" })).toBeInTheDocument());
  });

  it("refreshes the roster when the parent query version changes", () => {
    const { rerender } = renderTable({
      members: [createDeviceGroupMemberHealth({ serialNumber: "Before" })],
    });
    expect(screen.getByRole("link", { name: "Before" })).toBeInTheDocument();
    rerender(
      <DeviceTable
        members={[createDeviceGroupMemberHealth({ serialNumber: "After" })]}
        dataUpdatedAt={2}
      />,
    );
    expect(screen.queryByRole("link", { name: "Before" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "After" })).toBeInTheDocument();
  });

  it("uses the new monitoring window when two requests share an update timestamp", async () => {
    const { rerender } = renderTable({
      members: [createDeviceGroupMemberHealth({ serialNumber: "Before" })],
      range: RANGE,
    });
    expect(screen.getByRole("link", { name: "Before" })).toBeInTheDocument();

    rerender(
      <DeviceTable
        members={[createDeviceGroupMemberHealth({ serialNumber: "After" })]}
        range={{ ...RANGE, from: "2026-11-12T00:00:00.000Z", bucket: "day" }}
      />,
    );
    await waitFor(() => expect(screen.getByRole("link", { name: "After" })).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Before" })).not.toBeInTheDocument();
  });

  it("returns the loaded group members when explicitly refetched", async () => {
    const members = [createDeviceGroupMemberHealth({ serialNumber: "AA:11" })];
    const { result } = renderHook(() =>
      useGroupDevicesList({
        groupId: "group",
        range: RANGE,
        dataUpdatedAt: 1,
        members,
        labelByDeviceId: new Map(),
        pipelineUnavailable: false,
        now: NOW,
      }),
    );
    await act(async () => {
      const refreshed = await result.current.refetch();
      expect(refreshed.data).toEqual(members);
      expect(refreshed.error).toBeNull();
    });
    expect(result.current.data?.items).toEqual(members);
  });

  it("keeps a device name link from also triggering row navigation", async () => {
    const user = userEvent.setup();
    const member = createDeviceGroupMemberHealth({ serialNumber: "AA:11" });
    const { router } = renderTable({ members: [member] });
    const link = screen.getByRole("link", { name: "AA:11" });
    expect(link).toHaveAttribute("href", `/en-US/platform/devices/${member.deviceId}/monitoring`);
    link.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(link);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opens the device's dashboard from anywhere on the row", async () => {
    const user = userEvent.setup();
    const member = createDeviceGroupMemberHealth({ name: "Gateway", connectivity: online });
    const { router } = renderTable({
      members: [member],
      labels: new Map([[member.deviceId, "Gateway"]]),
    });

    await user.click(screen.getByText("iot.devices.connectivity.connected"));

    expect(router.push).toHaveBeenCalledWith(
      `/en-US/platform/devices/${member.deviceId}/monitoring`,
    );
  });
});
