import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { IotDevicesTableView } from "./iot-devices-table-view";

describe("IotDevicesTableView", () => {
  it("renders the fetched devices", async () => {
    server.mount(contract.iot.listIotDevices, {
      body: [createIotDevice({ name: "Alpha" }), createIotDevice({ name: "Beta" })],
    });

    render(<IotDevicesTableView />);

    expect(await screen.findByRole("link", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Beta" })).toBeInTheDocument();
  });

  it("shows the load error", async () => {
    server.mount(contract.iot.listIotDevices, { status: 401 });

    render(<IotDevicesTableView />);

    expect(await screen.findByText("devices.loadError")).toBeInTheDocument();
  });

  it("shows the empty state when there are no devices", async () => {
    server.mount(contract.iot.listIotDevices, { body: [] });

    render(<IotDevicesTableView />);

    expect(await screen.findByText("devices.empty.title")).toBeInTheDocument();
  });

  it("filters the table by search", async () => {
    server.mount(contract.iot.listIotDevices, {
      body: [createIotDevice({ name: "Alpha" }), createIotDevice({ name: "Beta" })],
    });
    const user = userEvent.setup();

    render(<IotDevicesTableView />);
    await screen.findByRole("link", { name: "Alpha" });

    await user.type(screen.getByPlaceholderText("devices.searchPlaceholder"), "Beta");

    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Alpha" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "Beta" })).toBeInTheDocument();
  });

  it("filters the table by status tab", async () => {
    server.mount(contract.iot.listIotDevices, {
      body: [
        createIotDevice({ name: "ActiveOne", status: "active" }),
        createIotDevice({ name: "PendingOne", status: "pending" }),
      ],
    });
    const user = userEvent.setup();

    render(<IotDevicesTableView />);
    await screen.findByRole("link", { name: "ActiveOne" });

    await user.click(screen.getByRole("tab", { name: /devices\.status\.active/ }));

    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "PendingOne" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "ActiveOne" })).toBeInTheDocument();
  });
});
