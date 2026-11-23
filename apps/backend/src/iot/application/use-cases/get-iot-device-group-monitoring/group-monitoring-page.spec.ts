import type {
  GroupMonitoringListQuery,
  IotDeviceGroupMemberHealth,
  IotDeviceGroupMonitoring,
} from "@repo/api/domains/iot/device-group/iot-device-group.schema";

import { groupMonitoringPage } from "./group-monitoring-page";

const NOW = Date.parse("2026-11-22T10:00:00.000Z");
const RECENT = "2026-11-22T09:30:00.000Z";

function member(
  name: string,
  overrides: Partial<IotDeviceGroupMemberHealth> = {},
): IotDeviceGroupMemberHealth {
  return {
    deviceId: name,
    name,
    serialNumber: `serial-${name}`,
    deviceType: "ambyte",
    connectivity: null,
    lastDataAt: null,
    ...overrides,
  };
}

const connected = { connected: true, lastSeenAt: null };
const silent = member("west-silent", { connectivity: connected });
const online = member("west-online", { connectivity: connected, lastDataAt: RECENT });
const offline = member("east-offline", {
  deviceType: "minipar",
  connectivity: { connected: false, lastSeenAt: null },
});
const unknownMinipar = member("unknown-minipar", { deviceType: "minipar" });
const unknownAmbit = member("unknown-ambit", { deviceType: "ambit" });
const monitoring: IotDeviceGroupMonitoring = {
  members: [silent, unknownMinipar, offline, online, unknownAmbit],
  throughput: [{ bucketStart: RECENT, deviceId: online.deviceId, count: 7 }],
  dataByExperiment: [],
  firmware: [],
  events: [],
  pipelineUnavailable: false,
};

function names(query: GroupMonitoringListQuery) {
  return groupMonitoringPage(monitoring, { page: 1, ...query }, NOW).members.map(
    ({ name }) => name,
  );
}

describe("groupMonitoringPage", () => {
  it("sorts State in menu order in both directions", () => {
    expect(names({ sort: [{ field: "health", direction: "asc" }] })).toEqual([
      "west-online",
      "east-offline",
      "unknown-minipar",
      "unknown-ambit",
      "west-silent",
    ]);
    expect(names({ sort: [{ field: "health", direction: "desc" }] })).toEqual([
      "west-silent",
      "unknown-minipar",
      "unknown-ambit",
      "east-offline",
      "west-online",
    ]);
  });

  it("sorts by family and lets family break ties in State ordering", () => {
    expect(names({ sort: [{ field: "family", direction: "asc" }] })).toEqual([
      "unknown-ambit",
      "west-silent",
      "west-online",
      "unknown-minipar",
      "east-offline",
    ]);
    expect(names({ sort: [{ field: "family", direction: "desc" }] })).toEqual([
      "unknown-minipar",
      "east-offline",
      "west-silent",
      "west-online",
      "unknown-ambit",
    ]);
    expect(
      names({
        sort: [
          { field: "health", direction: "asc" },
          { field: "family", direction: "asc" },
        ],
      }),
    ).toEqual(["west-online", "east-offline", "unknown-ambit", "unknown-minipar", "west-silent"]);
  });

  it("combines silent with case-insensitive search and accepts multiple State values", () => {
    expect(names({ health: ["silent"], search: " WEST " })).toEqual(["west-silent"]);
    expect(names({ health: ["silent"], search: "east" })).toEqual([]);
    expect(names({ health: ["offline", "silent"] })).toEqual(["west-silent", "east-offline"]);
    expect(names({ health: ["online"] })).toEqual(["west-silent", "west-online"]);
  });

  it("retains totals and chart facts when the requested page is out of range", () => {
    const result = groupMonitoringPage(monitoring, { page: 99, pageSize: 2 }, NOW);
    expect(result.members).toEqual([]);
    expect(result.pagination).toMatchObject({
      page: 99,
      totalPages: 3,
      totalCount: 5,
      online: 2,
      silent: 1,
      labels: { [online.deviceId]: online.name },
    });
    expect(result.throughput).toEqual(monitoring.throughput);
  });
});
