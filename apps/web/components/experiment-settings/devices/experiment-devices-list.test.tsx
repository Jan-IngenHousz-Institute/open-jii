import { createExperimentDeviceEntry, createIotDevice } from "@/test/factories";
import { arrayParam, openOnUrl } from "@/test/list-request";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDeviceEntry } from "@repo/api/domains/experiment/devices/experiment-devices.schema";

import { ExperimentDevicesList } from "./experiment-devices-list";
import { useExperimentDevicesList } from "./use-experiment-devices-list";

const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";
const PATH = `/platform/experiments/${EXPERIMENT_ID}/devices`;

const bench = createExperimentDeviceEntry({
  device: createIotDevice({ name: "Bench", deviceType: "ambyte", serialNumber: "AA:11" }),
  clientId: "bench",
});
const publisher = createExperimentDeviceEntry({ clientId: "unregistered-publisher", device: null });

function mountList() {
  return server.mount(contract.experiments.listExperimentDevices, {
    body: ({ query }: SpyCall) => ({
      devices: query["status[0]"] === "registered" || query.search ? [bench] : [bench, publisher],
      window: { from: "2026-08-04T12:00:00.000Z", to: "2026-09-03T12:00:00.000Z" },
      pipelineUnavailable: false,
      pagination: {
        page: Number(query.page),
        pageSize: 20,
        totalCount: 21,
        totalPages: 2,
        summary: { total: 21, onboarded: 0, sending: 1, onboardedSilent: 0, sendingUnbound: 1 },
        statusCounts: { registered: 12, provisioned: 0, onboarded: 9, revoked: 0, retired: 0 },
      },
    }),
  });
}

function List({ onSelect = vi.fn() }: { onSelect?: (entry: ExperimentDeviceEntry) => void }) {
  const list = useExperimentDevicesList(EXPERIMENT_ID);
  return <ExperimentDevicesList list={list} selectedClientId="bench" onSelect={onSelect} />;
}

describe("ExperimentDevicesList", () => {
  it("shows server status counts and requests the selected status from page one", async () => {
    const user = userEvent.setup();
    openOnUrl(PATH, "other=1&page=2");
    const request = mountList();
    const { router } = render(<List />);
    await screen.findByText("unregistered-publisher");
    expect(request.calls[0].query.page).toBe("2");

    await user.click(screen.getByRole("button", { name: "common.filter" }));
    await user.click(screen.getByRole("option", { name: "iot.devices.columns.status" }));
    await user.click(screen.getByRole("option", { name: /iot.devices.status.registered.*12/ }));
    await waitFor(() => expect(request.calls.at(-1)?.query.page).toBe("1"));
    expect(arrayParam(request.url, "status")).toEqual(["registered"]);
    expect(router.replace).toHaveBeenLastCalledWith(`${PATH}?other=1&status=registered`, {
      scroll: false,
    });
    await waitFor(() =>
      expect(screen.queryByText("unregistered-publisher")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("option", { name: /iot.devices.status.onboarded.*9/ }),
    ).toBeInTheDocument();
  });

  it("sends debounced search and selects a row from the server response", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const request = mountList();
    render(<List onSelect={onSelect} />);
    await screen.findByText("unregistered-publisher");
    await user.type(
      screen.getByPlaceholderText("iot.experimentDevices.searchPlaceholder"),
      "AA:11",
    );

    await waitFor(() => expect(request.calls.at(-1)?.query.search).toBe("AA:11"));
    await waitFor(() =>
      expect(within(screen.getByRole("list")).getAllByRole("button")).toHaveLength(1),
    );
    await user.click(screen.getByRole("button", { name: /Bench/ }));
    expect(onSelect).toHaveBeenCalledWith(bench);
  });

  it("sends registered-date and status sort in shift-click order and can reset it", async () => {
    const user = userEvent.setup();
    const request = mountList();
    render(<List />);
    await screen.findByText("unregistered-publisher");
    await user.click(screen.getByRole("button", { name: /iot.devices.columns.created:/ }));
    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("button", { name: /iot.devices.columns.status:/ }));
    await user.keyboard("{/Shift}");
    await waitFor(() => expect(request.calls.at(-1)?.query["sort[1][field]"]).toBe("status"));
    expect(request.calls.at(-1)?.query["sort[0][field]"]).toBe("registered");

    await user.click(screen.getByRole("button", { name: "common.resetSorting" }));
    await waitFor(() => expect(request.calls.at(-1)?.query["sort[0][field]"]).toBeUndefined());
  });
});
