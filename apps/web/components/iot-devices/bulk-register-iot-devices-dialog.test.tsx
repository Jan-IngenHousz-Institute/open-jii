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

function mountBase(existing: ReturnType<typeof createIotDevice>[] = []) {
  server.mount(contract.deviceGroups.listDeviceGroups, { body: [] });
  server.mount(contract.iot.listIotDevices, { body: existing });
}

async function pickFamily(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole("combobox")[0]);
  await user.click(await screen.findByRole("option", { name: "Ambyte" }));
}

const serialsInput = () => screen.getByLabelText("iot.devices.bulkDialog.serialsLabel");
const submitButton = () => screen.getByRole("button", { name: /bulkDialog.submit/ });

describe("BulkRegisterIotDevicesDialog", () => {
  it("registers the pasted batch and lands on linked results", async () => {
    const user = userEvent.setup();
    mountBase();
    const bulk = server.mount(contract.iot.bulkRegisterIotDevices, {
      body: { devices: [successRow("S-1"), successRow("S-2")], groupId: null, groupError: null },
    });

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    await pickFamily(user);
    // The blank line is skipped, not an error.
    await user.type(serialsInput(), "S-1, Gateway One{enter}{enter}S-2");
    await user.click(submitButton());

    await vi.waitFor(() => {
      expect(bulk.calls).toHaveLength(1);
    });
    expect(bulk.calls[0].body).toEqual({
      deviceType: "ambyte",
      devices: [{ serialNumber: "S-1", name: "Gateway One" }, { serialNumber: "S-2" }],
    });
    // Results replace the form: a per-row record with the way onward.
    expect(await screen.findByText("iot.devices.bulkDialog.resultSummary")).toBeInTheDocument();
  });

  it("classifies registry collisions up front and keeps them out of the submit", async () => {
    const user = userEvent.setup();
    mountBase([createIotDevice({ serialNumber: "S-1" })]);
    const bulk = server.mount(contract.iot.bulkRegisterIotDevices, {
      body: { devices: [successRow("S-2")], groupId: null, groupError: null },
    });

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    await pickFamily(user);
    await user.type(serialsInput(), "S-1{enter}S-2");

    // Pre-flight: the collision is a visible row state, not a later 409.
    expect(await screen.findByText("iot.devices.bulkDialog.status.registered")).toBeInTheDocument();
    await user.click(submitButton());

    await vi.waitFor(() => {
      expect(bulk.calls).toHaveLength(1);
    });
    expect(bulk.calls[0].body).toMatchObject({ devices: [{ serialNumber: "S-2" }] });
  });

  it("excludes in-batch duplicates and blocks oversized batches", async () => {
    const user = userEvent.setup();
    mountBase();
    const bulk = server.mount(contract.iot.bulkRegisterIotDevices, { status: 500 });

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    await pickFamily(user);
    await user.type(serialsInput(), "S-1{enter}S-1");
    expect(screen.getByText("iot.devices.bulkDialog.status.duplicate")).toBeInTheDocument();
    expect(screen.getByText(/summary.duplicate/)).toBeInTheDocument();

    const oversized = Array.from({ length: 101 }, (_, i) => `S-${String(i)}`).join("\n");
    fireEvent.change(serialsInput(), { target: { value: oversized } });
    expect(await screen.findByText("iot.devices.bulkDialog.overCap")).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();

    expect(bulk.calls).toHaveLength(0);
  });

  it("summarizes the batch live and blocks an empty submit", async () => {
    const user = userEvent.setup();
    mountBase();

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    expect(screen.getByText("iot.devices.bulkDialog.serialsHint")).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();

    await user.type(serialsInput(), "S-1{enter}S-2");
    expect(screen.getByText(/summary.ready/)).toBeInTheDocument();
    expect(submitButton()).toBeEnabled();

    await user.type(serialsInput(), "{enter}!!");
    expect(screen.getByText(/summary.invalid/)).toBeInTheDocument();
    expect(screen.getByText("iot.devices.bulkDialog.status.invalid")).toBeInTheDocument();
  });

  it("keeps an invalid-only paste from ever submitting", async () => {
    const user = userEvent.setup();
    mountBase();
    const bulk = server.mount(contract.iot.bulkRegisterIotDevices, { status: 500 });

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    await pickFamily(user);
    await user.type(serialsInput(), "not a serial!!");

    expect(screen.getByText("iot.devices.bulkDialog.status.invalid")).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    expect(bulk.calls).toHaveLength(0);
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

    await pickFamily(user);
    await user.type(serialsInput(), "S-1{enter}S-2");
    await user.click(screen.getByText("iot.devices.bulkDialog.groupExisting"));
    await user.click(screen.getAllByRole("combobox")[1]);
    await user.click(await screen.findByRole("option", { name: "Greenhouse A" }));
    await user.click(submitButton());

    await vi.waitFor(() => {
      expect(bulk.calls).toHaveLength(1);
    });
    expect(bulk.calls[0].body).toMatchObject({ group: { groupId: group.id } });
    // Partial failure lands on results with the error inline and the group linked.
    expect(await screen.findByText("already registered")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.bulkDialog.viewGroup")).toBeInTheDocument();
  });

  it("requires a group choice to match the selected mode", async () => {
    const user = userEvent.setup();
    mountBase();
    const bulk = server.mount(contract.iot.bulkRegisterIotDevices, { status: 500 });

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    await pickFamily(user);
    await user.type(serialsInput(), "S-1");

    await user.click(screen.getByText("iot.devices.bulkDialog.groupExisting"));
    await user.click(submitButton());
    expect(await screen.findByText("Pick a group")).toBeInTheDocument();

    await user.click(screen.getByText("iot.devices.bulkDialog.groupNew"));
    await user.click(submitButton());
    expect(await screen.findByText("Name the new group")).toBeInTheDocument();

    expect(bulk.calls).toHaveLength(0);
  });

  it("keeps the form up and toasts when the request itself fails", async () => {
    const user = userEvent.setup();
    mountBase();
    const bulk = server.mount(contract.iot.bulkRegisterIotDevices, { status: 500 });

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    await pickFamily(user);
    await user.type(serialsInput(), "S-1");
    await user.click(submitButton());

    await vi.waitFor(() => {
      expect(bulk.calls).toHaveLength(1);
    });
    expect(submitButton()).toBeInTheDocument();
  });

  it("resets and closes when the dialog is dismissed", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    mountBase();

    render(<BulkRegisterIotDevicesDialog open onOpenChange={onOpenChange} />);

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
