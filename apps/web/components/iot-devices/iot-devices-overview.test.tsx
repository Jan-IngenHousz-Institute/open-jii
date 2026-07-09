import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { IotDevicesOverview } from "./iot-devices-overview";

describe("IotDevicesOverview", () => {
  it("renders the fleet summary tiles and recent devices", async () => {
    server.mount(contract.iot.listIotDevices, {
      body: [
        createIotDevice({ name: "Recent One", status: "active" }),
        createIotDevice({ name: "Recent Two", status: "pending" }),
      ],
    });

    render(<IotDevicesOverview />);

    expect(await screen.findByRole("link", { name: "Recent One" })).toBeInTheDocument();
    expect(screen.getByText("iot.devices.recent.title")).toBeInTheDocument();
    // Summary tiles reuse the status labels ("All" tile + per-status tiles).
    expect(screen.getByText("iot.devices.tabs.all")).toBeInTheDocument();
  });

  it("shows the empty state when there are no devices", async () => {
    server.mount(contract.iot.listIotDevices, { body: [] });

    render(<IotDevicesOverview />);

    expect(await screen.findByText("iot.devices.empty.title")).toBeInTheDocument();
  });
});
