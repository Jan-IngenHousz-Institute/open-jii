import { createIotDevice } from "@/test/factories";
import { openOnUrl } from "@/test/list-request";
import { act, render, renderHook, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { ExperimentDeviceEntry } from "@repo/api/domains/experiment/devices/experiment-devices.schema";

import { ExperimentDevicesList } from "./experiment-devices-list";
import { useExperimentDevicesList } from "./use-experiment-devices-list";

const devices: ExperimentDeviceEntry[] = [
  {
    device: createIotDevice({ name: "Zulu", deviceType: "ambyte", serialNumber: "AA:11" }),
    clientId: "zulu",
    binding: null,
    connectivity: null,
    lastDataAt: null,
    recentData: null,
    reported: null,
    canView: true,
  },
  {
    device: createIotDevice({ name: "Alpha", deviceType: "mobile", serialNumber: "BB:22" }),
    clientId: "alpha",
    binding: null,
    connectivity: null,
    lastDataAt: null,
    recentData: null,
    reported: null,
    canView: true,
  },
  {
    device: null,
    clientId: "unregistered-publisher",
    binding: null,
    connectivity: null,
    lastDataAt: null,
    recentData: { measurementCount: 4, lastDataAt: null },
    reported: null,
    canView: false,
  },
];
const names = () =>
  within(screen.getByRole("list"))
    .getAllByRole("button")
    .map((button) => button.textContent);

function List({
  devices,
  dataUpdatedAt = 1,
  onSelect = vi.fn(),
}: {
  devices: ExperimentDeviceEntry[];
  dataUpdatedAt?: number;
  onSelect?: (clientId: string) => void;
}) {
  const list = useExperimentDevicesList({ experimentId: "exp", devices, dataUpdatedAt });
  return <ExperimentDevicesList list={list} selectedClientId="zulu" onSelect={onSelect} />;
}

function renderList(rows = devices) {
  const onSelect = vi.fn();
  return {
    ...render(<List devices={rows} onSelect={onSelect} />),
    onSelect,
  };
}

describe("ExperimentDevicesList", () => {
  it("preserves the source order and observed publishers, and selects from the filtered list", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderList();
    expect(names()[0]).toContain("Zulu");
    expect(screen.getByText("unregistered-publisher")).toBeInTheDocument();
    await user.type(
      screen.getByPlaceholderText("iot.experimentDevices.searchPlaceholder"),
      "BB:22",
    );
    await waitFor(() => expect(names()).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: /Alpha/ }));
    expect(onSelect).toHaveBeenCalledWith("alpha");
  });

  it("filters by family and clears the removable filter", async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: "common.filter" }));
    await user.click(screen.getByRole("option", { name: "iot.devices.columns.family" }));
    await user.click(screen.getByRole("option", { name: "Mobile" }));
    expect(names()).toHaveLength(1);
    expect(names()[0]).toContain("Alpha");
    await user.keyboard("{Escape}{Escape}");
    await user.click(screen.getByRole("button", { name: "common.removeFilterValue" }));
    expect(names()).toHaveLength(3);
  });

  it("cycles name sorting, supports a secondary family sort, and resets to the source order", async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: /iot.devices.columns.name:/ }));
    expect(names()[0]).toContain("Alpha");
    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("button", { name: /iot.devices.columns.family:/ }));
    await user.keyboard("{/Shift}");
    expect(
      screen.getByRole("button", { name: /iot.devices.columns.family:.*common.sortSecondary/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "common.resetSorting" }));
    expect(names()[0]).toContain("Zulu");
    await user.click(screen.getByRole("button", { name: /iot.devices.columns.name:/ }));
    await user.click(screen.getByRole("button", { name: /iot.devices.columns.name:/ }));
    expect(names()[0]).toContain("Zulu");
    await user.click(screen.getByRole("button", { name: /iot.devices.columns.name:/ }));
    expect(screen.queryByRole("button", { name: "common.resetSorting" })).not.toBeInTheDocument();
  });

  it("sorts families in both directions, keeping equal families stable and unregistered publishers visible", async () => {
    const user = userEvent.setup();
    renderList([
      devices[1],
      {
        ...devices[1],
        device: createIotDevice({ name: "Beta", deviceType: "mobile" }),
        clientId: "beta",
      },
      devices[2],
      devices[0],
    ]);
    await user.click(screen.getByRole("button", { name: /iot.devices.columns.family:/ }));
    expect(names()).toEqual([
      expect.stringContaining("unregistered-publisher"),
      expect.stringContaining("Zulu"),
      expect.stringContaining("Alpha"),
      expect.stringContaining("Beta"),
    ]);
    await user.click(screen.getByRole("button", { name: /iot.devices.columns.family:/ }));
    expect(names()).toEqual([
      expect.stringContaining("Alpha"),
      expect.stringContaining("Beta"),
      expect.stringContaining("Zulu"),
      expect.stringContaining("unregistered-publisher"),
    ]);
  });

  it("returns the loaded experiment devices when explicitly refetched", async () => {
    const { result } = renderHook(() =>
      useExperimentDevicesList({ experimentId: "exp", devices, dataUpdatedAt: 1 }),
    );
    await act(async () => {
      const refreshed = await result.current.refetch();
      expect(refreshed.data).toEqual(devices);
      expect(refreshed.error).toBeNull();
    });
    expect(result.current.data?.items).toEqual(devices);
  });

  it("restores search, family and sort from the URL without removing an unowned parameter", () => {
    openOnUrl(
      "/platform/experiments/exp/devices",
      `other=1&deviceFamily=mobile&q=BB&sort=${encodeURIComponent(JSON.stringify([{ field: "name", direction: "desc" }]))}`,
    );
    const { router } = renderList();
    expect(screen.getByPlaceholderText("iot.experimentDevices.searchPlaceholder")).toHaveValue(
      "BB",
    );
    expect(names()).toHaveLength(1);
    expect(names()[0]).toContain("Alpha");
    expect(
      screen.getByRole("button", { name: /iot.devices.columns.name: common.sortDescending/ }),
    ).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("clears search and family filters from the zero-results action", async () => {
    const user = userEvent.setup();
    openOnUrl("/platform/experiments/exp/devices", "deviceFamily=mobile&q=missing");
    renderList();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "common.clearFilters" })[1]);
    expect(screen.getByPlaceholderText("iot.experimentDevices.searchPlaceholder")).toHaveValue("");
    await waitFor(() => expect(names()).toHaveLength(3));
  });

  it("updates the loaded roster when the parent receives new devices", () => {
    const { rerender } = renderList();
    expect(names()).toHaveLength(3);
    rerender(<List devices={[devices[1]]} dataUpdatedAt={2} />);
    expect(names()).toHaveLength(1);
    expect(names()[0]).toContain("Alpha");
  });

  it("pages at 20 and resets the page on filter changes", async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 21 }, (_, index) => ({
      ...devices[2],
      clientId: `publisher-${index}`,
    }));
    renderList(rows);
    expect(names()).toHaveLength(20);
    await user.click(screen.getByRole("button", { name: "pagination.next" }));
    expect(names()).toHaveLength(1);
    expect(screen.getByText("publisher-20")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /iot.devices.columns.name:/ }));
    expect(names()).toHaveLength(20);
    expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
  });
});
