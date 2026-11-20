import { OPEN_DEVICE_BULK_REGISTER_EVENT } from "@/components/navigation/site-header/platform-header-events";
import { createIotDevice } from "@/test/factories";
import { arrayParam, listEnvelope, openOnUrl } from "@/test/list-request";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { act, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { IotDeviceWithConnectivity } from "@repo/api/domains/iot/iot.schema";

import { IotDevicesTableView } from "./iot-devices-table-view";

const statusCounts = { registered: 12, provisioned: 1, onboarded: 14, revoked: 0, retired: 5 };
function devicePage(items: IotDeviceWithConnectivity[], page = 1, totalPages = 1) {
  return { ...listEnvelope(items, page, totalPages), statusCounts };
}

beforeEach(() => openOnUrl("/platform/devices", ""));

describe("IotDevicesTableView", () => {
  it("keeps a Filter menu with search and route-wide registration actions out of the toolbar", async () => {
    const spy = server.mount(contract.iot.listIotDevices, {
      body: devicePage([createIotDevice({ name: "Alpha" })]),
    });
    render(<IotDevicesTableView />);
    await screen.findByRole("link", { name: "Alpha" });
    expect(screen.getByRole("button", { name: "common.filter" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "iot.devices.bulkDialog.open" })).toBeNull();
    expect(screen.queryByRole("button", { name: "iot.devices.register" })).toBeNull();
    expect(spy.calls[0]?.query.page).toBe("1");
  });

  it("opens bulk registration from the header event", async () => {
    server.mount(contract.iot.listIotDevices, {
      body: devicePage([createIotDevice({ name: "Alpha" })]),
    });
    server.mount(contract.iot.listIotDeviceGroups, { body: [] });
    render(<IotDevicesTableView />);
    await screen.findByRole("link", { name: "Alpha" });
    act(() => {
      window.dispatchEvent(new Event(OPEN_DEVICE_BULK_REGISTER_EVENT));
    });
    expect(await screen.findByText("iot.devices.bulkDialog.title")).toBeInTheDocument();
  });

  it("requests the next page and renders the server's order without re-sorting it", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.iot.listIotDevices, {
      body: (call: SpyCall) =>
        devicePage(
          [createIotDevice({ name: call.query.page === "2" ? "Page two" : "Page one" })],
          Number(call.query.page),
          2,
        ),
    });
    render(<IotDevicesTableView />);
    await screen.findByRole("link", { name: "Page one" });
    await user.click(screen.getByRole("button", { name: "pagination.next" }));
    expect(await screen.findByRole("link", { name: "Page two" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Page one" })).toBeNull();
    expect(spy.calls.map((call) => call.query.page)).toEqual(["1", "2"]);
  });

  it("disables both pagination buttons for a one-page result", async () => {
    server.mount(contract.iot.listIotDevices, {
      body: devicePage([createIotDevice({ name: "Alpha" })]),
    });
    render(<IotDevicesTableView />);
    await screen.findByRole("link", { name: "Alpha" });
    expect(screen.getByRole("button", { name: "pagination.previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "pagination.next" })).toBeDisabled();
  });

  it("makes stale rows and pagination inert while the next page loads", async () => {
    const user = userEvent.setup();
    server.mount(contract.iot.listIotDevices, {
      body: devicePage([createIotDevice({ name: "Page one" })], 1, 2),
    });
    render(<IotDevicesTableView />);
    await screen.findByRole("link", { name: "Page one" });
    let release: () => void = () => undefined;
    const unblock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = server.mount(contract.iot.listIotDevices, {
      body: devicePage([createIotDevice({ name: "Page two" })], 2, 2),
      unblock,
    });

    await user.click(screen.getByRole("button", { name: "pagination.next" }));
    await waitFor(() => expect(spy.called).toBe(true));
    const busy = screen.getByRole("table").closest("[aria-busy]");
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(busy).toHaveAttribute("inert");
    expect(busy).toHaveClass("opacity-50", "pointer-events-none");
    expect(busy).toContainElement(screen.getByRole("link", { name: "Page one" }));
    expect(busy).toContainElement(screen.getByRole("button", { name: "pagination.previous" }));
    expect(
      screen.getByPlaceholderText("iot.devices.searchPlaceholder").closest("[inert]"),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "common.filter" }).closest("[inert]")).toBeNull();

    act(() => {
      release();
    });
    await screen.findByRole("link", { name: "Page two" });
    expect(busy).toHaveAttribute("aria-busy", "false");
    expect(busy).not.toHaveAttribute("inert");
  });

  it("keeps the existing responsive table and room for the search placeholder", async () => {
    const longName = "A very long field deployment sensor name that must not consume the table";
    server.mount(contract.iot.listIotDevices, {
      body: devicePage([createIotDevice({ name: longName, serialNumber: "SERIAL-1" })]),
    });
    render(<IotDevicesTableView />);
    const link = await screen.findByRole("link", { name: longName });
    expect(link).toHaveClass("truncate", "min-w-0");
    expect(link).toHaveAttribute("title", longName);
    const table = screen.getByRole("table");
    expect(table).toHaveClass("table-fixed");
    const headers = Array.from(table.querySelectorAll("thead th"));
    const cells = Array.from(table.querySelectorAll("tbody tr")[0].children);
    for (const index of [1, 2, 3, 4, 5]) {
      expect(headers[index]).toHaveClass("hidden");
      expect(cells[index]).toHaveClass("hidden");
    }
    expect(
      screen.getByPlaceholderText("iot.devices.searchPlaceholder").closest("form")?.parentElement,
    ).toHaveClass("md:w-80");
  });

  it("keeps search, filters and chips on load errors and retries the current view", async () => {
    openOnUrl("/platform/devices", "q=Alpha&status=registered");
    const user = userEvent.setup();
    server.mount(contract.iot.listIotDevices, { status: 401 });
    render(<IotDevicesTableView />);
    expect(await screen.findByText("iot.devices.loadError")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("iot.devices.searchPlaceholder")).toHaveValue("Alpha");
    expect(screen.getByRole("button", { name: /common.filter/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "common.removeFilterValue" })).toBeVisible();
    const spy = server.mount(contract.iot.listIotDevices, {
      body: devicePage([createIotDevice({ name: "Alpha" })]),
    });
    await user.click(screen.getByRole("button", { name: "errors.tryAgain" }));
    expect(await screen.findByRole("link", { name: "Alpha" })).toBeVisible();
    expect(spy.calls[0]?.query.search).toBe("Alpha");
    expect(arrayParam(spy.url, "status")).toEqual(["registered"]);
    expect(screen.queryByText("iot.devices.loadError")).not.toBeInTheDocument();
  });

  it("shows the registry empty state and still opens bulk registration", async () => {
    server.mount(contract.iot.listIotDevices, { body: devicePage([]) });
    server.mount(contract.iot.listIotDeviceGroups, { body: [] });
    render(<IotDevicesTableView />);
    await screen.findByText("iot.devices.empty.title");
    act(() => {
      window.dispatchEvent(new Event(OPEN_DEVICE_BULK_REGISTER_EVENT));
    });
    expect(await screen.findByText("iot.devices.bulkDialog.title")).toBeInTheDocument();
  });

  it("searches on the server and distinguishes no matches from an empty registry", async () => {
    server.mount(contract.iot.listIotDevices, {
      body: (call: SpyCall) =>
        devicePage(call.query.search ? [] : [createIotDevice({ name: "Alpha" })]),
    });
    const user = userEvent.setup();
    render(<IotDevicesTableView />);
    await screen.findByRole("link", { name: "Alpha" });
    await user.type(screen.getByPlaceholderText("iot.devices.searchPlaceholder"), "zzz");
    expect(await screen.findByText("iot.devices.zeroResults.title")).toBeVisible();
    expect(screen.queryByText("iot.devices.empty.title")).toBeNull();
    await user.click(screen.getByRole("button", { name: "iot.devices.zeroResults.clear" }));
    expect(await screen.findByRole("link", { name: "Alpha" })).toBeVisible();
  });

  it("shows server status counts, multi-selects values and adds removable chips", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.iot.listIotDevices, {
      body: devicePage([createIotDevice({ name: "Alpha" })]),
    });
    render(<IotDevicesTableView />);
    await screen.findByRole("link", { name: "Alpha" });
    await user.click(screen.getByRole("button", { name: "common.filter" }));
    await user.click(screen.getByRole("option", { name: "iot.devices.columns.status" }));
    await user.click(screen.getByRole("option", { name: "iot.devices.status.onboarded 14" }));
    await waitFor(() => expect(arrayParam(spy.url, "status")).toEqual(["onboarded"]));
    expect(screen.getByRole("option", { name: "iot.devices.status.registered 12" })).toBeVisible();
    expect(screen.getByRole("option", { name: "iot.devices.status.revoked 0" })).toBeVisible();
    await user.click(screen.getByRole("option", { name: "iot.devices.status.registered 12" }));
    await waitFor(() => expect(arrayParam(spy.url, "status")).toEqual(["registered", "onboarded"]));
    await user.keyboard("{Escape}{Escape}");
    expect(screen.getAllByRole("button", { name: "common.removeFilterValue" })).toHaveLength(2);
  });

  it("offers all families without counts", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.iot.listIotDevices, {
      body: devicePage([createIotDevice({ name: "Alpha" })]),
    });
    render(<IotDevicesTableView />);
    await screen.findByRole("link", { name: "Alpha" });
    await user.click(screen.getByRole("button", { name: "common.filter" }));
    await user.click(screen.getByRole("option", { name: "iot.devices.columns.family" }));
    await user.click(screen.getByRole("option", { name: "Mobile" }));
    await waitFor(() => expect(arrayParam(spy.url, "family")).toEqual(["mobile"]));
  });

  it.each(["name", "status", "family", "created"] as const)(
    "sorts %s both ways and resets sorting",
    async (column) => {
      const user = userEvent.setup();
      const spy = server.mount(contract.iot.listIotDevices, {
        body: devicePage([createIotDevice({ name: "Alpha" })]),
      });
      render(<IotDevicesTableView />);
      await screen.findByRole("link", { name: "Alpha" });
      await user.click(
        screen.getByRole("button", { name: `iot.devices.columns.${column}: common.sortUnsorted` }),
      );
      await waitFor(() => expect(spy.calls.at(-1)?.query["sort[0][direction]"]).toBe("asc"));
      expect(spy.calls.at(-1)?.query["sort[0][field]"]).toBe(
        column === "created" ? "registered" : column,
      );
      expect(
        screen
          .getByRole("button", { name: `iot.devices.columns.${column}: common.sortAscending` })
          .closest("th"),
      ).toHaveAttribute("aria-sort", "ascending");
      await user.click(
        screen.getByRole("button", { name: `iot.devices.columns.${column}: common.sortAscending` }),
      );
      await waitFor(() => expect(spy.calls.at(-1)?.query["sort[0][direction]"]).toBe("desc"));
      await user.click(screen.getByRole("button", { name: "common.resetSorting" }));
      await waitFor(() => expect(spy.calls.at(-1)?.query["sort[0][field]"]).toBeUndefined());
    },
  );
});
