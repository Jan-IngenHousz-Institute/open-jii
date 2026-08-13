import { createIotDevice } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ExperimentDeviceRow } from "./experiment-device-row";

const device = createIotDevice({
  name: "Field Gateway",
  serialNumber: "SN-0001",
  deviceType: "ambyte",
  status: "active",
});

const binding = {
  device: {
    id: device.id,
    thingName: device.thingName,
    serialNumber: device.serialNumber,
    name: device.name,
    deviceType: device.deviceType,
    status: device.status,
  },
  addedBy: "22222222-2222-4222-8222-222222222222",
  addedAt: new Date().toISOString(),
};

describe("ExperimentDeviceRow", () => {
  it("shows the device name, serial, and status", () => {
    render(
      <ul>
        <ExperimentDeviceRow binding={binding} onDetach={vi.fn()} />
      </ul>,
    );

    expect(screen.getByText("Field Gateway")).toBeInTheDocument();
    expect(screen.getByText("SN-0001")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.status.active")).toBeInTheDocument();
  });

  it("falls back to the serial number for an unnamed device", () => {
    const unnamed = { ...binding, device: { ...binding.device, name: null } };
    render(
      <ul>
        <ExperimentDeviceRow binding={unnamed} onDetach={vi.fn()} />
      </ul>,
    );

    expect(screen.getAllByText("SN-0001")).toHaveLength(2);
  });

  it("requests a detach for its device", async () => {
    const user = userEvent.setup();
    const onDetach = vi.fn();
    render(
      <ul>
        <ExperimentDeviceRow binding={binding} onDetach={onDetach} />
      </ul>,
    );

    await user.click(screen.getByRole("button", { name: "iot.experimentDevices.detach" }));

    expect(onDetach).toHaveBeenCalledWith(device.id);
  });
});
