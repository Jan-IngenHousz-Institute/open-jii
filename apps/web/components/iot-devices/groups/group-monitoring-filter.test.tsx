import { createDeviceGroupMemberHealth } from "@/test/factories";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { GroupMonitoringFilter } from "./group-monitoring-filter";
import { useGroupDevicesList } from "./use-group-devices-list";

const members = [
  createDeviceGroupMemberHealth({
    name: "Online",
    deviceType: "mobile",
    connectivity: { connected: true, lastSeenAt: null },
  }),
  createDeviceGroupMemberHealth({
    name: "Offline",
    deviceType: "ambit",
    connectivity: { connected: false, lastSeenAt: null },
  }),
  createDeviceGroupMemberHealth({ name: "Unknown", deviceType: "multispeq", connectivity: null }),
];
const labels = new Map(
  members.map((member) => [member.deviceId, member.name ?? member.serialNumber]),
);

function Filter() {
  const list = useGroupDevicesList({
    groupId: "group-1",
    range: {
      from: "2026-11-18T00:00:00.000Z",
      to: "2026-11-19T00:00:00.000Z",
      bucket: "hour",
    },
    dataUpdatedAt: 1,
    members,
    labelByDeviceId: labels,
    pipelineUnavailable: true,
    now: Date.now(),
  });
  return (
    <>
      <GroupMonitoringFilter list={list} />
      <output>{list.matchingMembers.map((member) => member.name).join(",")}</output>
    </>
  );
}

describe("GroupMonitoringFilter", () => {
  it("accepts several health values, with removable chips and Clear filters", async () => {
    const user = userEvent.setup();
    render(<Filter />);
    await user.click(screen.getByRole("button", { name: /^common.filter/ }));
    await user.click(screen.getByRole("option", { name: "iot.groups.monitoring.stateColumn" }));
    await user.click(screen.getByRole("option", { name: "iot.groups.monitoring.filter.offline" }));
    await user.click(screen.getByRole("option", { name: "iot.groups.monitoring.unknownLabel" }));
    expect(screen.getByRole("status")).toHaveTextContent("Offline,Unknown");
    await user.keyboard("{Escape}{Escape}");
    await user.click(screen.getAllByRole("button", { name: "common.removeFilterValue" })[0]);
    expect(screen.getByRole("status")).toHaveTextContent("Unknown");
    await user.click(screen.getByRole("button", { name: "common.clearFilters" }));
    expect(screen.getByRole("status")).toHaveTextContent("Online,Offline,Unknown");
  });

  it("combines multiple families with health and clears both filters", async () => {
    const user = userEvent.setup();
    render(<Filter />);
    await user.click(screen.getByRole("button", { name: /^common.filter/ }));
    await user.click(screen.getByRole("option", { name: "iot.devices.columns.family" }));
    await user.click(screen.getByRole("option", { name: "Ambit" }));
    await user.click(screen.getByRole("option", { name: "MultispeQ" }));
    expect(screen.getByRole("status")).toHaveTextContent(/^Offline,Unknown$/);
    await user.keyboard("{Escape}{Escape}");
    await user.click(screen.getByRole("button", { name: /^common.filter/ }));
    await user.click(screen.getByRole("option", { name: "iot.groups.monitoring.stateColumn" }));
    await user.click(screen.getByRole("option", { name: "iot.groups.monitoring.filter.offline" }));
    expect(screen.getByRole("status")).toHaveTextContent(/^Offline$/);
    await user.keyboard("{Escape}{Escape}");
    expect(screen.getAllByRole("button", { name: "common.removeFilterValue" })).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "common.clearFilters" }));
    expect(screen.getByRole("status")).toHaveTextContent(/^Online,Offline,Unknown$/);
  });

  it("searches while keeping selected health values", async () => {
    const user = userEvent.setup();
    render(<Filter />);
    await user.type(
      screen.getByPlaceholderText("iot.groups.monitoring.filter.searchPlaceholder"),
      "Offline",
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/^Offline$/));
  });
});
