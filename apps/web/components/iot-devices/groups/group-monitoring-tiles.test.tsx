import { createDeviceGroupMemberHealth } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type {
  DeviceGroupMemberHealth,
  DeviceGroupMonitoring,
  DeviceGroupThroughputBucket,
} from "@repo/api/domains/device-group/device-group.schema";

import type { MonitoringRange } from "../monitoring/monitoring-range";
import { GroupMonitoringTiles } from "./group-monitoring-tiles";

// Real wall clock: the last-data tile formats relative to Date.now().
const NOW = Date.now();
const STALE = new Date(NOW - 3 * 3_600_000).toISOString();
const RECENT = new Date(NOW - 30 * 60_000).toISOString();

const online = { connected: true, lastSeenAt: null };

const RANGE: MonitoringRange = {
  from: new Date(NOW - 12 * 3_600_000).toISOString(),
  to: new Date(NOW).toISOString(),
  bucket: "hour",
};

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

interface TilesSetup {
  monitoring?: DeviceGroupMonitoring;
  members?: DeviceGroupMemberHealth[];
  throughput?: DeviceGroupThroughputBucket[];
}

function renderTiles({ monitoring, members = [], throughput = [] }: TilesSetup) {
  return render(
    <GroupMonitoringTiles
      monitoring={monitoring}
      members={members}
      throughput={throughput}
      range={RANGE}
      locale="en-US"
      now={NOW}
    />,
  );
}

describe("GroupMonitoringTiles", () => {
  it("renders labeled skeletons until monitoring arrives", () => {
    renderTiles({ monitoring: undefined });

    expect(screen.getByText("iot.groups.monitoring.onlineLabel")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.measurements")).toBeInTheDocument();
    expect(screen.queryByText("iot.groups.monitoring.onlineValue")).not.toBeInTheDocument();
    expect(screen.queryByText("iot.devices.monitoring.perHour")).not.toBeInTheDocument();
  });

  it("summarizes who is online and warns about silent members", () => {
    const members = [
      createDeviceGroupMemberHealth({ connectivity: online, lastDataAt: STALE }),
      createDeviceGroupMemberHealth({ connectivity: online, lastDataAt: RECENT }),
    ];

    renderTiles({ monitoring: monitoringWith(members), members });

    expect(screen.getByText("iot.groups.monitoring.onlineValue")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.monitoring.silentCount")).toBeInTheDocument();
  });

  it("drops the silent warning when everyone delivers", () => {
    const members = [createDeviceGroupMemberHealth({ connectivity: online, lastDataAt: RECENT })];

    renderTiles({ monitoring: monitoringWith(members), members });

    expect(screen.queryByText("iot.groups.monitoring.silentCount")).not.toBeInTheDocument();
  });

  it("reports last data as unavailable while the pipeline is down", () => {
    const members = [createDeviceGroupMemberHealth({ connectivity: online, lastDataAt: RECENT })];

    renderTiles({ monitoring: monitoringWith(members, true), members });

    expect(screen.getByText("iot.devices.monitoring.lastDataUnavailable")).toBeInTheDocument();
  });

  it("says so when no member has delivered data", () => {
    const members = [createDeviceGroupMemberHealth({ lastDataAt: null })];

    renderTiles({ monitoring: monitoringWith(members), members });

    expect(screen.getByText("iot.groups.monitoring.noData")).toBeInTheDocument();
  });

  it("shows the freshest member's data as relative time", () => {
    const members = [
      createDeviceGroupMemberHealth({ lastDataAt: STALE }),
      createDeviceGroupMemberHealth({ lastDataAt: RECENT }),
    ];

    renderTiles({ monitoring: monitoringWith(members), members });

    expect(screen.getByText("30 minutes ago")).toBeInTheDocument();
  });

  it("totals the window's measurements with a localized count and hourly rate", () => {
    const members = [createDeviceGroupMemberHealth()];

    renderTiles({
      monitoring: monitoringWith(members),
      members,
      throughput: [
        { bucketStart: RANGE.from, deviceId: members[0].deviceId, count: 900 },
        { bucketStart: RANGE.from, deviceId: members[0].deviceId, count: 334 },
      ],
    });

    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.perHour")).toBeInTheDocument();
  });
});
