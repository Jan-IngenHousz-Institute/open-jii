import type { MonitoringRange } from "@/components/iot-devices/monitoring/monitoring-range";
import { createDeviceGroupMemberHealth } from "@/test/factories";
import { openOnUrl } from "@/test/list-request";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
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
  range?: MonitoringRange;
}

function DeviceTable({
  members,
  labels = new Map(),
  versions = new Map(),
  pipelineUnavailable = false,
  range = RANGE,
}: TableSetup) {
  const list = useGroupDevicesList("11111111-1111-4111-8111-111111111111", range);
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
  const request = server.mount(contract.iot.getIotDeviceGroupMonitoring, {
    body: ({ query }: SpyCall) =>
      monitoringWith(query.search ? [] : props.members, props.pipelineUnavailable),
  });
  return { ...render(<DeviceTable {...props} />), request };
}

describe("GroupDevicesTable", () => {
  it("links each member to its own monitoring dashboard, falling back to the serial", async () => {
    const labeled = createDeviceGroupMemberHealth({ name: "Gateway One" });
    const bare = createDeviceGroupMemberHealth({ name: null, serialNumber: "BB:22" });

    renderTable({
      members: [labeled, bare],
      labels: new Map([[labeled.deviceId, "Gateway One"]]),
    });

    expect(await screen.findByRole("link", { name: "Gateway One" })).toHaveAttribute(
      "href",
      `/en-US/platform/devices/${labeled.deviceId}/monitoring`,
    );
    expect(screen.getByRole("link", { name: "BB:22" })).toHaveAttribute(
      "href",
      `/en-US/platform/devices/${bare.deviceId}/monitoring`,
    );
  });

  it("flags only the connected member that stopped delivering", async () => {
    renderTable({
      members: [
        createDeviceGroupMemberHealth({ connectivity: online, lastDataAt: STALE }),
        createDeviceGroupMemberHealth({ connectivity: online, lastDataAt: RECENT }),
      ],
    });

    expect(await screen.findAllByText("iot.devices.monitoring.connectedButSilent")).toHaveLength(1);
  });

  it("reports last data as unavailable while the pipeline is down", async () => {
    renderTable({
      members: [createDeviceGroupMemberHealth({ connectivity: online, lastDataAt: null })],
      pipelineUnavailable: true,
    });

    expect(
      await screen.findByText("iot.devices.monitoring.lastDataUnavailable"),
    ).toBeInTheDocument();
    expect(screen.queryByText("iot.devices.monitoring.connectedButSilent")).not.toBeInTheDocument();
  });

  it("shows the firmware column only when a version is known", async () => {
    const member = createDeviceGroupMemberHealth();

    const { unmount } = renderTable({ members: [member] });
    await screen.findByRole("link");
    expect(screen.queryByText("iot.groups.monitoring.versionColumn")).not.toBeInTheDocument();
    unmount();

    renderTable({ members: [member], versions: new Map([[member.deviceId, "1.2.3"]]) });
    expect(await screen.findByText("iot.groups.monitoring.versionColumn")).toBeInTheDocument();
    expect(await screen.findByText("1.2.3")).toBeInTheDocument();
  });

  it("shows the no-matches message when the filter empties the roster", () => {
    openOnUrl("/platform/devices/groups/group/monitoring", "q=unmatched");
    renderTable({ members: [createDeviceGroupMemberHealth({ serialNumber: "AA:11" })] });

    expect(screen.getByText("iot.groups.monitoring.filter.noMatches")).toBeInTheDocument();
  });

  it("sends health and secondary family sorting to the server", async () => {
    const user = userEvent.setup();
    const { request } = renderTable({
      members: [createDeviceGroupMemberHealth({ serialNumber: "AA:11" })],
    });
    await screen.findByRole("link", { name: "AA:11" });
    await user.click(screen.getByRole("button", { name: /iot.groups.monitoring.stateColumn:/ }));
    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("button", { name: /iot.devices.columns.family:/ }));
    await user.keyboard("{/Shift}");
    await waitFor(() => expect(request.calls.at(-1)?.query["sort[1][field]"]).toBe("family"));
    expect(request.calls.at(-1)?.query["sort[0][field]"]).toBe("health");
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
    await screen.findByText("iot.groups.monitoring.filter.noMatches");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "common.clearFilters" })[1]);
    expect(
      screen.getByPlaceholderText("iot.groups.monitoring.filter.searchPlaceholder"),
    ).toHaveValue("");
    await waitFor(() => expect(screen.getByRole("link", { name: "AA:11" })).toBeInTheDocument());
  });

  it("keeps a device name link from also triggering row navigation", async () => {
    const user = userEvent.setup();
    const member = createDeviceGroupMemberHealth({ serialNumber: "AA:11" });
    const { router } = renderTable({ members: [member] });
    const link = await screen.findByRole("link", { name: "AA:11" });
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

    await user.click(await screen.findByText("iot.devices.connectivity.connected"));

    expect(router.push).toHaveBeenCalledWith(
      `/en-US/platform/devices/${member.deviceId}/monitoring`,
    );
  });
});
