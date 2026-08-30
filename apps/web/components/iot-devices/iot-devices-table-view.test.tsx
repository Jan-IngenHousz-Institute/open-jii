import { OPEN_DEVICE_BULK_REGISTER_EVENT } from "@/components/navigation/site-header/platform-header-events";
import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, createTestQueryClient, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { IotDevicesTableView } from "./iot-devices-table-view";

describe("IotDevicesTableView", () => {
  it("keeps filters with search and route-wide registration actions out of the toolbar", async () => {
    server.mount(contract.iot.listIotDevices, { body: [createIotDevice({ name: "Alpha" })] });

    render(<IotDevicesTableView />);

    await screen.findByRole("link", { name: "Alpha" });
    const toolbar = screen
      .getByPlaceholderText("iot.devices.searchPlaceholder")
      .closest("div.flex.flex-col");
    expect(toolbar).toContainElement(
      screen.getByRole("button", { name: /iot\.devices\.tabs\.all/ }),
    );
    expect(screen.queryByRole("button", { name: "iot.devices.bulkDialog.open" })).toBeNull();
    expect(screen.queryByRole("button", { name: "iot.devices.register" })).toBeNull();
  });

  it("opens bulk registration from the overview toolbar", async () => {
    server.mount(contract.iot.listIotDevices, { body: [createIotDevice({ name: "Alpha" })] });
    server.mount(contract.iot.listIotDeviceGroups, { body: [] });

    render(<IotDevicesTableView />);
    await screen.findByRole("link", { name: "Alpha" });
    act(() => {
      window.dispatchEvent(new Event(OPEN_DEVICE_BULK_REGISTER_EVENT));
    });

    expect(await screen.findByText("iot.devices.bulkDialog.title")).toBeInTheDocument();
  });

  it("renders the fetched devices", async () => {
    server.mount(contract.iot.listIotDevices, {
      body: [createIotDevice({ name: "Alpha" }), createIotDevice({ name: "Beta" })],
    });

    render(<IotDevicesTableView />);

    expect(await screen.findByRole("link", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Beta" })).toBeInTheDocument();
  });

  it("paginates a device collection that exceeds the local page size", async () => {
    const user = userEvent.setup();
    server.mount(contract.iot.listIotDevices, {
      body: Array.from({ length: 26 }, (_, index) =>
        createIotDevice({
          id: `device-${index + 1}`,
          name: `Device ${String(index + 1).padStart(2, "0")}`,
          createdAt: new Date(2026, 0, index + 1).toISOString(),
        }),
      ),
    });

    render(<IotDevicesTableView />);

    expect(await screen.findByRole("link", { name: "Device 26" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Device 01" })).toBeNull();

    await user.click(screen.getByLabelText("Go to next page"));

    expect(await screen.findByRole("link", { name: "Device 01" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Device 26" })).toBeNull();
  });

  it("keeps device pagination visible and disabled when everything fits on one page", async () => {
    server.mount(contract.iot.listIotDevices, { body: [createIotDevice({ name: "Alpha" })] });

    render(<IotDevicesTableView />);

    expect(await screen.findByRole("link", { name: "Alpha" })).toBeVisible();
    expect(screen.getByLabelText("Go to previous page")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByLabelText("Go to next page")).toHaveAttribute("aria-disabled", "true");
  });

  it("constrains long device names so the remaining columns stay available", async () => {
    const longName = "A very long field deployment sensor name that must not consume the table";
    server.mount(contract.iot.listIotDevices, {
      body: [createIotDevice({ name: longName, serialNumber: "SERIAL-VISIBLE" })],
    });

    render(<IotDevicesTableView />);

    const link = await screen.findByRole("link", { name: longName });
    expect(link).toHaveClass("truncate", "min-w-0");
    expect(link).toHaveAttribute("title", longName);
    expect(screen.getByRole("table")).toHaveClass("table-fixed");
    expect(screen.getByRole("table").parentElement?.parentElement).toHaveClass(
      "rounded-md",
      "border",
    );
    expect(screen.getByRole("table").parentElement?.parentElement).not.toHaveClass("border-y");
    expect(screen.getByText("SERIAL-VISIBLE")).toBeVisible();
  });

  it("does not present the initial dataset fetch as a pending search", async () => {
    server.mount(contract.iot.listIotDevices, {
      body: [createIotDevice({ name: "Alpha" })],
      delay: 100,
    });

    render(<IotDevicesTableView />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Alpha" })).toBeInTheDocument();
  });

  it("shows the load error", async () => {
    server.mount(contract.iot.listIotDevices, { status: 401 });

    render(<IotDevicesTableView />);

    expect(await screen.findByText("iot.devices.loadError")).toBeInTheDocument();
  });

  it("shows the empty state when there are no devices", async () => {
    server.mount(contract.iot.listIotDevices, { body: [] });

    render(<IotDevicesTableView />);

    expect(await screen.findByText("iot.devices.empty.title")).toBeInTheDocument();
  });

  it("opens bulk registration from the header when the device fleet is empty", async () => {
    server.mount(contract.iot.listIotDevices, { body: [] });
    server.mount(contract.iot.listIotDeviceGroups, { body: [] });

    render(<IotDevicesTableView />);
    await screen.findByText("iot.devices.empty.title");
    act(() => {
      window.dispatchEvent(new Event(OPEN_DEVICE_BULK_REGISTER_EVENT));
    });

    expect(await screen.findByText("iot.devices.bulkDialog.title")).toBeInTheDocument();
  });

  it("filters the table by search", async () => {
    server.mount(contract.iot.listIotDevices, {
      body: [createIotDevice({ name: "Alpha" }), createIotDevice({ name: "Beta" })],
    });
    const user = userEvent.setup();

    render(<IotDevicesTableView />);
    await screen.findByRole("link", { name: "Alpha" });

    await user.type(screen.getByPlaceholderText("iot.devices.searchPlaceholder"), "Beta");

    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Alpha" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "Beta" })).toBeInTheDocument();
  });

  it("does not show a loading spinner for synchronous local filtering", async () => {
    server.mount(contract.iot.listIotDevices, { body: [createIotDevice({ name: "Alpha" })] });
    const user = userEvent.setup();

    render(<IotDevicesTableView />);
    await screen.findByRole("link", { name: "Alpha" });

    await user.type(screen.getByPlaceholderText("iot.devices.searchPlaceholder"), "alp");

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers to clear filters when the search matches nothing", async () => {
    server.mount(contract.iot.listIotDevices, { body: [createIotDevice({ name: "Alpha" })] });
    const user = userEvent.setup();

    render(<IotDevicesTableView />);
    await screen.findByRole("link", { name: "Alpha" });

    await user.type(screen.getByPlaceholderText("iot.devices.searchPlaceholder"), "zzz");
    expect(await screen.findByText("iot.devices.zeroResults.title")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "iot.devices.zeroResults.clear" }));
    expect(await screen.findByRole("link", { name: "Alpha" })).toBeInTheDocument();
  });

  it("keeps the no-results state when a searched device collection becomes empty", async () => {
    server.mount(contract.iot.listIotDevices, { body: [createIotDevice({ name: "Alpha" })] });
    const queryClient = createTestQueryClient();
    const user = userEvent.setup();

    render(<IotDevicesTableView />, { queryClient });
    await screen.findByRole("link", { name: "Alpha" });
    await user.type(screen.getByPlaceholderText("iot.devices.searchPlaceholder"), "zzz");
    await screen.findByText("iot.devices.zeroResults.title");

    server.mount(contract.iot.listIotDevices, { body: [] });
    await act(() => queryClient.refetchQueries());

    expect(screen.getByText("iot.devices.zeroResults.title")).toBeInTheDocument();
    expect(screen.queryByText("iot.devices.empty.title")).not.toBeInTheDocument();
  });

  it("filters the table by status chip", async () => {
    server.mount(contract.iot.listIotDevices, {
      body: [
        createIotDevice({ name: "ActiveOne", status: "active" }),
        createIotDevice({ name: "PendingOne", status: "pending" }),
      ],
    });
    const user = userEvent.setup();

    render(<IotDevicesTableView />);
    await screen.findByRole("link", { name: "ActiveOne" });

    // A chip's accessible name carries its count, so match on the label alone.
    await user.click(screen.getByRole("button", { name: /devices\.status\.active/ }));

    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "PendingOne" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "ActiveOne" })).toBeInTheDocument();
  });
});
