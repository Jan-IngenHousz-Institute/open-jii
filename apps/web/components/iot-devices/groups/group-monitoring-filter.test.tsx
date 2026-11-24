import { arrayParam } from "@/test/list-request";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { GroupMonitoringFilter } from "./group-monitoring-filter";
import { useGroupDevicesList } from "./use-group-devices-list";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

function Filter() {
  const list = useGroupDevicesList(GROUP_ID, {
    from: "2026-11-18T00:00:00.000Z",
    to: "2026-11-19T00:00:00.000Z",
    bucket: "hour",
  });
  return <GroupMonitoringFilter list={list} />;
}

describe("GroupMonitoringFilter", () => {
  it("combines several families with health, removes a chip and clears all filters", async () => {
    const user = userEvent.setup();
    const request = server.mount(contract.iot.getIotDeviceGroupMonitoring, {
      body: {
        members: [],
        throughput: [],
        dataByExperiment: [],
        firmware: [],
        events: [],
        pipelineUnavailable: false,
      },
    });
    render(<Filter />);
    await user.click(screen.getByRole("button", { name: /^common.filter/ }));
    await user.click(screen.getByRole("option", { name: "iot.devices.columns.family" }));
    await user.click(screen.getByRole("option", { name: "Ambit" }));
    await user.click(screen.getByRole("option", { name: "MultispeQ" }));
    await user.keyboard("{Escape}{Escape}");
    await user.click(screen.getByRole("button", { name: /^common.filter/ }));
    await user.click(screen.getByRole("option", { name: "iot.groups.monitoring.stateColumn" }));
    await user.click(screen.getByRole("option", { name: "iot.groups.monitoring.filter.offline" }));
    await waitFor(() => expect(arrayParam(request.url, "health")).toEqual(["offline"]));
    expect(arrayParam(request.url, "family").sort()).toEqual(["ambit", "multispeq"]);

    await user.keyboard("{Escape}{Escape}");
    const remove = screen.getAllByRole("button", { name: "common.removeFilterValue" });
    expect(remove).toHaveLength(3);
    await user.click(remove[0]);
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "common.removeFilterValue" })).toHaveLength(2),
    );
    await user.click(screen.getByRole("button", { name: "common.clearFilters" }));
    await waitFor(() => expect(arrayParam(request.url, "family")).toEqual([]));
  });
});
