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
  it("links the device name to its page and shows serial and status", () => {
    render(
      <ul>
        <ExperimentDeviceRow binding={binding} onRequestDetach={vi.fn()} />
      </ul>,
    );

    expect(screen.getByRole("link", { name: "Field Gateway" })).toHaveAttribute(
      "href",
      `/en-US/platform/devices/${device.id}`,
    );
    expect(screen.getByText("SN-0001")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.status.active")).toBeInTheDocument();
  });

  it("falls back to the serial number for an unnamed device", () => {
    const unnamed = { ...binding, device: { ...binding.device, name: null } };
    render(
      <ul>
        <ExperimentDeviceRow binding={unnamed} onRequestDetach={vi.fn()} />
      </ul>,
    );

    expect(screen.getAllByText("SN-0001")).toHaveLength(2);
  });

  it("asks for a detach rather than firing one", async () => {
    const user = userEvent.setup();
    const onRequestDetach = vi.fn();
    render(
      <ul>
        <ExperimentDeviceRow binding={binding} onRequestDetach={onRequestDetach} />
      </ul>,
    );

    await user.click(screen.getByRole("button", { name: "iot.experimentDevices.detach" }));

    // The row only nominates; the panel owns the confirm and the mutation.
    expect(onRequestDetach).toHaveBeenCalledWith(binding.device);
  });
});
