import { createDeviceGroup, createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { fireEvent, render, screen } from "@/test/test-utils";
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
    // The blank line is skipped, not an error.
    await user.type(
      screen.getByLabelText("iot.devices.bulkDialog.serialsLabel"),
      "S-1, Gateway One{enter}{enter}S-2",
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

  it("resets and closes when the dialog is dismissed", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    server.mount(contract.deviceGroups.listDeviceGroups, { body: [] });

    render(<BulkRegisterIotDevicesDialog open onOpenChange={onOpenChange} />);

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the form up and toasts when the request itself fails", async () => {
    const user = userEvent.setup();
    server.mount(contract.deviceGroups.listDeviceGroups, { body: [] });
    const bulk = server.mount(contract.iot.bulkRegisterIotDevices, { status: 500 });

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Ambyte" }));
    await user.type(screen.getByLabelText("iot.devices.bulkDialog.serialsLabel"), "S-1");
    await user.click(screen.getByRole("button", { name: "iot.devices.bulkDialog.submit" }));

    await vi.waitFor(() => {
      expect(bulk.calls).toHaveLength(1);
    });
    expect(
      screen.getByRole("button", { name: "iot.devices.bulkDialog.submit" }),
    ).toBeInTheDocument();
  });

  it("rejects duplicate serials and oversized batches client-side", async () => {
    const user = userEvent.setup();
    server.mount(contract.deviceGroups.listDeviceGroups, { body: [] });
    const bulk = server.mount(contract.iot.bulkRegisterIotDevices, { status: 500 });

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Ambyte" }));
    const serials = screen.getByLabelText("iot.devices.bulkDialog.serialsLabel");

    await user.type(serials, "S-1{enter}S-1");
    await user.click(screen.getByRole("button", { name: "iot.devices.bulkDialog.submit" }));
    expect(await screen.findByText(/must be unique/)).toBeInTheDocument();

    const oversized = Array.from({ length: 101 }, (_, i) => `S-${String(i)}`).join("\n");
    fireEvent.change(serials, { target: { value: oversized } });
    await user.click(screen.getByRole("button", { name: "iot.devices.bulkDialog.submit" }));
    expect(await screen.findByText(/At most 100 devices/)).toBeInTheDocument();

    expect(bulk.calls).toHaveLength(0);
  });

  it("requires a group choice to match the selected mode", async () => {
    const user = userEvent.setup();
    server.mount(contract.deviceGroups.listDeviceGroups, { body: [] });
    const bulk = server.mount(contract.iot.bulkRegisterIotDevices, { status: 500 });

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Ambyte" }));
    await user.type(screen.getByLabelText("iot.devices.bulkDialog.serialsLabel"), "S-1");

    await user.click(screen.getByText("iot.devices.bulkDialog.groupExisting"));
    await user.click(screen.getByRole("button", { name: "iot.devices.bulkDialog.submit" }));
    expect(await screen.findByText("Pick a group")).toBeInTheDocument();

    await user.click(screen.getByText("iot.devices.bulkDialog.groupNew"));
    await user.click(screen.getByRole("button", { name: "iot.devices.bulkDialog.submit" }));
    expect(await screen.findByText("Name the new group")).toBeInTheDocument();

    expect(bulk.calls).toHaveLength(0);
  });

  it("counts recognized devices live and blocks an empty submit", async () => {
    const user = userEvent.setup();
    server.mount(contract.deviceGroups.listDeviceGroups, { body: [] });

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    // Nothing typed: hint shown, submit disabled.
    expect(screen.getByText("iot.devices.bulkDialog.serialsHint")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bulkDialog.submit/ })).toBeDisabled();

    await user.type(screen.getByLabelText("iot.devices.bulkDialog.serialsLabel"), "S-1{enter}S-2");
    expect(screen.getByText("iot.devices.bulkDialog.recognized")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bulkDialog.submit/ })).toBeEnabled();

    await user.type(screen.getByLabelText("iot.devices.bulkDialog.serialsLabel"), "{enter}!!");
    expect(screen.getByText("iot.devices.bulkDialog.invalidLine")).toBeInTheDocument();
  });

  it("keeps an invalid serial line from ever submitting", async () => {
    const user = userEvent.setup();
    server.mount(contract.deviceGroups.listDeviceGroups, { body: [] });
    const bulk = server.mount(contract.iot.bulkRegisterIotDevices, { status: 500 });

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Ambyte" }));
    await user.type(screen.getByLabelText("iot.devices.bulkDialog.serialsLabel"), "not a serial!!");

    // The bad line is flagged live and the submit never becomes clickable.
    expect(screen.getByText("iot.devices.bulkDialog.invalidLine")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bulkDialog.submit/ })).toBeDisabled();
    expect(bulk.calls).toHaveLength(0);
  });
});
