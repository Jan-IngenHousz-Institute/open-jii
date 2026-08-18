import { createDeviceGroup, createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { BulkRegisterIotDevicesDialog } from "./bulk-register-iot-devices-dialog";

function successRow(serialNumber: string) {
  return { serialNumber, device: createIotDevice({ serialNumber }), error: null };
}

describe("BulkRegisterIotDevicesDialog", () => {
  it("parses one device per line and closes on full success", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    server.mount(contract.deviceGroups.listDeviceGroups, { body: [] });
    server.mount(contract.iot.listIotDevices, { body: [] });
    const bulk = server.mount(contract.iot.bulkRegisterIotDevices, {
      body: { devices: [successRow("S-1"), successRow("S-2")], groupId: null, groupError: null },
    });

    render(<BulkRegisterIotDevicesDialog open onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Ambyte" }));
    await user.type(
      screen.getByLabelText("iot.devices.bulkDialog.serialsLabel"),
      "S-1, Gateway One{enter}S-2",
    );
    await user.click(screen.getByRole("button", { name: "iot.devices.bulkDialog.submit" }));

    await vi.waitFor(() => {
      expect(bulk.calls).toHaveLength(1);
    });
    expect(bulk.calls[0].body).toEqual({
      deviceType: "ambyte",
      devices: [{ serialNumber: "S-1", name: "Gateway One" }, { serialNumber: "S-2" }],
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sends the chosen group and shows per-serial failures", async () => {
    const user = userEvent.setup();
    const group = createDeviceGroup({ name: "Greenhouse A" });
    server.mount(contract.deviceGroups.listDeviceGroups, { body: [group] });
    server.mount(contract.iot.listIotDevices, { body: [] });
    const bulk = server.mount(contract.iot.bulkRegisterIotDevices, {
      body: {
        devices: [
          successRow("S-1"),
          { serialNumber: "S-2", device: null, error: "already registered" },
        ],
        groupId: group.id,
        groupError: null,
      },
    });

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByRole("option", { name: "Ambyte" }));
    await user.type(screen.getByLabelText("iot.devices.bulkDialog.serialsLabel"), "S-1{enter}S-2");
    await user.click(screen.getByText("iot.devices.bulkDialog.groupExisting"));
    await user.click(screen.getAllByRole("combobox")[1]);
    await user.click(await screen.findByRole("option", { name: "Greenhouse A" }));
    await user.click(screen.getByRole("button", { name: "iot.devices.bulkDialog.submit" }));

    await vi.waitFor(() => {
      expect(bulk.calls).toHaveLength(1);
    });
    expect(bulk.calls[0].body).toMatchObject({ group: { groupId: group.id } });
    // Partial failure keeps the dialog open on the results view.
    expect(await screen.findByText("already registered")).toBeInTheDocument();
  });

  it("rejects an invalid serial line before submitting", async () => {
    const user = userEvent.setup();
    server.mount(contract.deviceGroups.listDeviceGroups, { body: [] });
    const bulk = server.mount(contract.iot.bulkRegisterIotDevices, { status: 500 });

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Ambyte" }));
    await user.type(screen.getByLabelText("iot.devices.bulkDialog.serialsLabel"), "not a serial!!");
    await user.click(screen.getByRole("button", { name: "iot.devices.bulkDialog.submit" }));

    expect(await screen.findByText(/Invalid line/)).toBeInTheDocument();
    expect(bulk.calls).toHaveLength(0);
  });
});
