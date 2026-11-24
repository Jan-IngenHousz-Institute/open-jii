import { BarChart } from "@/components/charts/bar-chart";
import { createDeviceGroupMemberHealth } from "@/test/factories";
import { arrayParam, openOnUrl } from "@/test/list-request";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import {
  filterGroupMembers,
  memberStatus,
  summarizeGroupHealth,
} from "@repo/api/domains/iot/device-group/group-health";
import { zGroupMemberHealth } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import type { IotDeviceGroupMonitoring } from "@repo/api/domains/iot/device-group/iot-device-group.schema";
import { zDeviceType } from "@repo/api/domains/iot/iot.schema";

import { GroupMonitoringContent } from "./group-monitoring-content";

vi.mock("@/components/charts/bar-chart", () => ({
  BarChart: vi.fn(() => <div data-testid="bar-chart" />),
  HorizontalBarChart: vi.fn(() => <div data-testid="horizontal-bar-chart" />),
}));

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

const STALE = "2026-08-18T00:00:00.000Z";

type MonitoringBody = Pick<IotDeviceGroupMonitoring, "members"> &
  Partial<Omit<IotDeviceGroupMonitoring, "members">>;

function mountMonitoring(body: MonitoringBody) {
  server.mount(contract.experiments.listExperiments, { body: [] });
  return server.mount(contract.iot.getIotDeviceGroupMonitoring, {
    body: ({ query, url }: SpyCall): IotDeviceGroupMonitoring => {
      const params = new URL(url).searchParams;
      const page = Number(params.get("page") ?? 1);
      const now = Date.now();
      const pipelineUnavailable = body.pipelineUnavailable ?? false;
      const members = filterGroupMembers(
        body.members,
        {
          search: params.get("search") ?? "",
          families: zDeviceType.array().parse(arrayParam(url, "family")),
          statuses: zGroupMemberHealth.array().parse(arrayParam(url, "health")),
        },
        pipelineUnavailable,
        now,
        (member) => member.name ?? member.serialNumber,
      );
      if (query["sort[0][field]"] === "name") {
        members.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
      }
      if (query["sort[0][field]"] === "health") {
        members.sort((a, b) => memberStatus(a).localeCompare(memberStatus(b)));
      }
      const includes = (row: { deviceId: string | null }) =>
        members.some((member) => member.deviceId === row.deviceId);
      return {
        members: members.slice((page - 1) * 20, page * 20),
        throughput: body.throughput?.filter(includes) ?? [],
        dataByExperiment: body.dataByExperiment ?? [],
        firmware: body.firmware?.filter(includes) ?? [],
        events: body.events?.filter(includes) ?? [],
        pipelineUnavailable,
        pagination: {
          ...summarizeGroupHealth(members, pipelineUnavailable, now),
          groupSize: body.members.length,
          totalCount: members.length,
          totalPages: Math.max(1, Math.ceil(members.length / 20)),
          page,
          pageSize: 20,
          labels: Object.fromEntries(
            members.map((member) => [member.deviceId, member.name ?? member.serialNumber]),
          ),
          freshest: members.find((member) => member.lastDataAt)?.lastDataAt ?? null,
        },
      };
    },
  });
}

describe("GroupMonitoringContent", () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ groupId: GROUP_ID });
  });

  it("renders tiles, roster, throughput, and the event log for one window", async () => {
    const gateway = createDeviceGroupMemberHealth({
      name: "Gateway One",
      connectivity: { connected: true, lastSeenAt: null },
      lastDataAt: STALE,
    });
    mountMonitoring({
      members: [gateway],
      throughput: [{ bucketStart: STALE, deviceId: gateway.deviceId, count: 7 }],
      events: [
        {
          deviceId: gateway.deviceId,
          eventType: "disconnected",
          eventTimestamp: STALE,
          disconnectReason: "CONNECTION_LOST",
        },
      ],
    });

    render(<GroupMonitoringContent />);

    // Tiles: rollup value; roster: member row linking to the device dashboard.
    expect(await screen.findByText("iot.groups.monitoring.onlineValue")).toBeInTheDocument();
    const memberLink = screen.getByRole("link", { name: "Gateway One" });
    expect(memberLink).toHaveAttribute(
      "href",
      `/en-US/platform/devices/${gateway.deviceId}/monitoring`,
    );
    // Throughput: window total; event log: the disconnect with the member's name.
    expect(screen.getByText("iot.devices.monitoring.throughputTotal")).toBeInTheDocument();
    expect(screen.getByText("Gateway One · CONNECTION_LOST")).toBeInTheDocument();
    // A stale-but-connected member carries the silent flag in roster and tiles.
    expect(screen.getByText("iot.groups.monitoring.silentCount")).toBeInTheDocument();
    expect(screen.getAllByText("iot.devices.monitoring.connectedButSilent")).toHaveLength(1);
  });

  it("scopes every member-attributed panel to the search filter", async () => {
    const user = userEvent.setup();
    const alpha = createDeviceGroupMemberHealth({
      name: "Alpha",
      connectivity: { connected: true, lastSeenAt: null },
      lastDataAt: STALE,
    });
    const beta = createDeviceGroupMemberHealth({
      name: "Beta",
      connectivity: null,
    });
    mountMonitoring({
      members: [alpha, beta],
      throughput: [
        { bucketStart: STALE, deviceId: alpha.deviceId, count: 3 },
        { bucketStart: STALE, deviceId: beta.deviceId, count: 9 },
      ],
      firmware: [
        { deviceId: alpha.deviceId, version: "1.0.0", lastSeen: STALE },
        { deviceId: beta.deviceId, version: "2.0.0", lastSeen: STALE },
      ],
    });

    render(<GroupMonitoringContent />);

    // Both firmware versions in the field: flagged as mixed.
    expect(await screen.findByText("iot.groups.monitoring.mixedFirmware")).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("iot.groups.monitoring.filter.searchPlaceholder"),
      "alpha",
    );

    expect(screen.getByRole("link", { name: "Alpha" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Beta" })).not.toBeInTheDocument(),
    );
    // Firmware follows the filter, so the mixed-version flag clears.
    expect(screen.queryByText("iot.groups.monitoring.mixedFirmware")).not.toBeInTheDocument();
  });

  it("scopes tiles, throughput, firmware and events to the selected family", async () => {
    const user = userEvent.setup();
    const alpha = createDeviceGroupMemberHealth({
      name: "Alpha",
      deviceType: "ambyte",
      connectivity: { connected: true, lastSeenAt: null },
      lastDataAt: STALE,
    });
    const beta = createDeviceGroupMemberHealth({
      name: "Beta",
      deviceType: "mobile",
      connectivity: null,
    });
    mountMonitoring({
      members: [alpha, beta],
      throughput: [
        { bucketStart: new Date().toISOString(), deviceId: alpha.deviceId, count: 3 },
        { bucketStart: new Date().toISOString(), deviceId: beta.deviceId, count: 9 },
      ],
      firmware: [
        { deviceId: alpha.deviceId, version: "1.0.0", lastSeen: STALE },
        { deviceId: beta.deviceId, version: "2.0.0", lastSeen: STALE },
      ],
      events: [alpha, beta].map((member) => ({
        deviceId: member.deviceId,
        eventType: "disconnected",
        eventTimestamp: STALE,
        disconnectReason: "CONNECTION_LOST",
      })),
    });
    render(<GroupMonitoringContent />);
    await screen.findByText("iot.groups.monitoring.mixedFirmware");
    expect(screen.getByText("iot.groups.monitoring.silentCount")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "common.filter" }));
    await user.click(screen.getByRole("option", { name: "iot.devices.columns.family" }));
    await user.click(screen.getByRole("option", { name: "Mobile" }));
    await user.keyboard("{Escape}{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Alpha" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "Beta" })).toBeInTheDocument();
    expect(screen.queryByText("iot.groups.monitoring.silentCount")).not.toBeInTheDocument();
    expect(screen.queryByText("iot.groups.monitoring.mixedFirmware")).not.toBeInTheDocument();
    expect(screen.queryByText("1.0.0")).not.toBeInTheDocument();
    expect(screen.queryByText("Alpha · CONNECTION_LOST")).not.toBeInTheDocument();
    expect(screen.getByText("Beta · CONNECTION_LOST")).toBeInTheDocument();
    expect(vi.mocked(BarChart).mock.lastCall?.[0].data).toEqual([
      expect.objectContaining({ name: "Beta" }),
    ]);
    expect(screen.getByTitle("9")).toBeInTheDocument();
  });

  it("filters by health from the Filter menu", async () => {
    const user = userEvent.setup();
    mountMonitoring({
      members: [
        createDeviceGroupMemberHealth({
          name: "Online One",
          connectivity: { connected: true, lastSeenAt: null },
          lastDataAt: STALE,
        }),
        createDeviceGroupMemberHealth({ name: "Ghost", connectivity: null }),
      ],
    });

    render(<GroupMonitoringContent />);

    await screen.findByRole("link", { name: "Online One" });
    await user.click(screen.getByRole("button", { name: "common.filter" }));
    await user.click(screen.getByRole("option", { name: "iot.groups.monitoring.stateColumn" }));
    await user.click(screen.getByRole("option", { name: "iot.groups.monitoring.filter.silent" }));

    expect(screen.getByRole("link", { name: "Online One" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Ghost" })).not.toBeInTheDocument(),
    );
  });

  it("pages and sorts only the roster while summary panels keep all matching members", async () => {
    const user = userEvent.setup();
    const members = Array.from({ length: 21 }, (_, index) =>
      createDeviceGroupMemberHealth({
        name: `Gateway ${String(21 - index).padStart(2, "0")}`,
        connectivity: null,
      }),
    );
    const offPage = members[20];
    const request = mountMonitoring({
      members,
      throughput: [{ bucketStart: new Date().toISOString(), deviceId: offPage.deviceId, count: 7 }],
      firmware: [{ deviceId: offPage.deviceId, version: "7.0.0", lastSeen: STALE }],
      events: [
        {
          deviceId: offPage.deviceId,
          eventType: "disconnected",
          eventTimestamp: STALE,
          disconnectReason: "CONNECTION_LOST",
        },
      ],
    });
    render(<GroupMonitoringContent />);
    await screen.findByRole("link", { name: "Gateway 21" });
    expect(screen.queryByRole("link", { name: "Gateway 01" })).not.toBeInTheDocument();
    expect(screen.getByTitle("7")).toBeInTheDocument();
    expect(screen.getByText("Gateway 01 · CONNECTION_LOST")).toBeInTheDocument();
    expect(screen.getByText("7.0.0")).toBeInTheDocument();
    expect(vi.mocked(BarChart).mock.lastCall?.[0].data).toEqual([
      expect.objectContaining({ name: "Gateway 01" }),
    ]);
    await user.click(screen.getByRole("button", { name: "pagination.next" }));
    expect(await screen.findByRole("link", { name: "Gateway 01" })).toBeInTheDocument();
    expect(request.calls.map(({ query }) => query.page)).toEqual(["1", "2"]);
    expect(screen.queryByRole("link", { name: "Gateway 21" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /iot.groups.deviceColumn:/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled(),
    );
    expect(screen.getAllByRole("link")[0]).toHaveTextContent("Gateway 01");
    expect(screen.queryByRole("link", { name: "Gateway 21" })).not.toBeInTheDocument();
    expect(screen.getByTitle("7")).toBeInTheDocument();
    expect(vi.mocked(BarChart).mock.lastCall?.[0].data).toEqual([
      expect.objectContaining({ name: "Gateway 01" }),
    ]);
    await user.click(screen.getByRole("button", { name: "common.resetSorting" }));
    expect(await screen.findByRole("link", { name: "Gateway 21" })).toBeInTheDocument();
  });

  it("restores list state across range changes and preserves an unowned URL parameter", async () => {
    const user = userEvent.setup();
    openOnUrl(
      `/platform/devices/groups/${GROUP_ID}/monitoring`,
      `other=1&groupHealth=offline,unknown&deviceFamily=ambyte,mobile&q=Gateway&sort=${encodeURIComponent(JSON.stringify([{ field: "health", direction: "asc" }]))}`,
    );
    mountMonitoring({
      members: [
        createDeviceGroupMemberHealth({
          name: "Gateway Online",
          deviceType: "ambyte",
          connectivity: { connected: true, lastSeenAt: null },
        }),
        createDeviceGroupMemberHealth({
          name: "Gateway Unknown",
          deviceType: "mobile",
          connectivity: null,
        }),
        createDeviceGroupMemberHealth({
          name: "Gateway Offline",
          deviceType: "ambyte",
          connectivity: { connected: false, lastSeenAt: null },
        }),
        createDeviceGroupMemberHealth({
          name: "Gateway Other Family",
          deviceType: "multispeq",
          connectivity: null,
        }),
        createDeviceGroupMemberHealth({
          name: "Other Offline",
          connectivity: { connected: false, lastSeenAt: null },
        }),
      ],
    });
    const { router } = render(<GroupMonitoringContent />);
    await screen.findByRole("link", { name: "Gateway Offline" });
    expect(
      screen.getByPlaceholderText("iot.groups.monitoring.filter.searchPlaceholder"),
    ).toHaveValue("Gateway");
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Gateway Offline",
      "Gateway Unknown",
    ]);
    expect(
      screen.getByRole("columnheader", { name: "iot.groups.monitoring.stateColumn" }),
    ).toHaveAttribute("aria-sort", "ascending");
    await user.click(screen.getByText("iot.devices.monitoring.range.last7d"));
    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(2));
    expect(
      screen.getByPlaceholderText("iot.groups.monitoring.filter.searchPlaceholder"),
    ).toHaveValue("Gateway");
    await user.click(screen.getByRole("button", { name: "common.resetSorting" }));
    expect(router.replace).toHaveBeenLastCalledWith(
      expect.stringContaining(
        "other=1&groupHealth=offline,unknown&deviceFamily=ambyte,mobile&q=Gateway",
      ),
      { scroll: false },
    );
    expect(
      screen.getByRole("button", { name: "iot.devices.monitoring.range.last7d" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("never judges silence when the pipeline is unavailable, and says why", async () => {
    mountMonitoring({
      members: [
        createDeviceGroupMemberHealth({
          name: "Gateway One",
          connectivity: { connected: true, lastSeenAt: null },
          lastDataAt: null,
        }),
      ],
      pipelineUnavailable: true,
    });

    render(<GroupMonitoringContent />);

    expect(
      await screen.findByText("iot.groups.monitoring.pipelineUnavailable"),
    ).toBeInTheDocument();
    expect(screen.queryByText("iot.devices.monitoring.connectedButSilent")).not.toBeInTheDocument();
  });

  it("shows the empty state for a memberless group", async () => {
    mountMonitoring({ members: [] });

    render(<GroupMonitoringContent />);

    expect(await screen.findByText("iot.groups.noMembers")).toBeInTheDocument();
  });

  it("offers a retry that refetches after a failure", async () => {
    const user = userEvent.setup();
    server.mount(contract.experiments.listExperiments, { body: [] });
    const monitoring = server.mount(contract.iot.getIotDeviceGroupMonitoring, {
      status: 500,
    });

    render(<GroupMonitoringContent />);

    expect(await screen.findByText("iot.devices.monitoring.loadError")).toBeInTheDocument();
    await user.click(screen.getByText("iot.devices.monitoring.retry"));

    await vi.waitFor(() => {
      expect(monitoring.callCount).toBeGreaterThan(1);
    });
  });

  it("reloads the window when a range preset is picked", async () => {
    const user = userEvent.setup();
    mountMonitoring({ members: [] });

    render(<GroupMonitoringContent />);

    await screen.findByText("iot.groups.noMembers");
    await user.click(screen.getByText("iot.devices.monitoring.range.last7d"));

    // A new window means a new request with a day-grain bucket.
    await vi.waitFor(() => {
      expect(screen.getByText("iot.groups.noMembers")).toBeInTheDocument();
    });
  });
});
