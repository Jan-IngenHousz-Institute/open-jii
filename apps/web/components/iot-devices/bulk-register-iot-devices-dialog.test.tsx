import { createIotDeviceGroup, createIotDevice } from "@/test/factories";
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
  server.mount(contract.iot.listIotDeviceGroups, { body: [] });
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

  it("blocks submission while the registry cannot vouch for the paste", async () => {
    const user = userEvent.setup();
    server.mount(contract.deviceGroups.listDeviceGroups, { body: [] });
    const registry = server.mount(contract.iot.listIotDevices, { status: 500 });

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    await pickFamily(user);
    await user.type(serialsInput(), "S-1");

    // Without the registry the collision pre-flight would lie, so the submit waits.
    await screen.findByText("iot.devices.bulkDialog.registryError");
    expect(submitButton()).toBeDisabled();
    expect(registry.calls.length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "iot.devices.monitoring.retry" }),
    ).toBeInTheDocument();
  });

  it("rejects an oversized import file before reading it", async () => {
    const user = userEvent.setup();
    mountBase();

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    await pickFamily(user);
    const oversized = new File([new Uint8Array(512 * 1024 + 1)], "serials.csv", {
      type: "text/csv",
    });
    fireEvent.drop(serialsInput(), { dataTransfer: { files: [oversized] } });

    expect(await screen.findByText("iot.devices.bulkDialog.fileTooLarge")).toBeInTheDocument();
    // Nothing was appended to the textarea.
    expect(serialsInput()).toHaveValue("");
    await user.type(serialsInput(), "S-1");
    expect(submitButton()).toBeEnabled();
  });

  it("sends the chosen group and shows per-serial failures", async () => {
    const user = userEvent.setup();
    const group = createIotDeviceGroup({ name: "Greenhouse A" });
    server.mount(contract.iot.listIotDeviceGroups, { body: [group] });
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

  it("imports a dropped file into the batch", async () => {
    mountBase();

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    const file = new File(["S-1\nS-2, North gate"], "serials.csv", { type: "text/csv" });
    fireEvent.drop(serialsInput(), { dataTransfer: { files: [file] } });

    // FileReader resolves async; the batch classifies once the text lands.
    expect(await screen.findByText(/summary.ready/)).toBeInTheDocument();
    expect(screen.getByText("North gate")).toBeInTheDocument();
  });

  it("imports a picked file through the import button", async () => {
    const user = userEvent.setup();
    mountBase();

    render(<BulkRegisterIotDevicesDialog open onOpenChange={vi.fn()} />);

    const file = new File(["S-9"], "serials.txt", { type: "text/plain" });
    await user.upload(screen.getByLabelText("iot.devices.bulkDialog.importFile"), file);

    expect(await screen.findByText(/summary.ready/)).toBeInTheDocument();
    // Textarea content and preview cell both carry the serial.
    expect(screen.getAllByText("S-9")).toHaveLength(2);
  });
});
