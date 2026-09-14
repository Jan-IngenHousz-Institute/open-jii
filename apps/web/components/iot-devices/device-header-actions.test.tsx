import { createIotDeviceDetail, readOnlyCapabilities } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { DeviceHeaderActions } from "./device-header-actions";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

describe("DeviceHeaderActions", () => {
  it("deletes through the overflow menu after a confirm, then leaves the page", async () => {
    const deleteSpy = server.mount(contract.iot.deleteIotDevice);
    const user = userEvent.setup();
    const device = createIotDeviceDetail({ id: DEVICE_ID, name: "Doomed" });

    const { router } = render(<DeviceHeaderActions device={device} />);

    await user.click(screen.getByRole("button", { name: /iot\.devices\.actions\.title/ }));
    await user.click(await screen.findByText("iot.devices.remove.title"));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "iot.devices.actions.delete" }));

    await waitFor(() => {
      expect(deleteSpy.called).toBe(true);
    });
    expect(deleteSpy.params.deviceId).toBe(DEVICE_ID);
    await waitFor(() => {
      expect(router.push).toHaveBeenCalled();
    });
  });

  it("retires through the overflow menu after a confirm, and stays on the page", async () => {
    const retireSpy = server.mount(contract.iot.retireIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID, status: "retired" }),
    });
    const user = userEvent.setup();
    const device = createIotDeviceDetail({ id: DEVICE_ID, name: "Field unit", status: "active" });

    const { router } = render(<DeviceHeaderActions device={device} />);

    await user.click(screen.getByRole("button", { name: /iot\.devices\.actions\.title/ }));
    await user.click(await screen.findByText("iot.devices.actions.retire"));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("iot.devices.retire.title")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "iot.devices.actions.retire" }));

    await waitFor(() => {
      expect(retireSpy.called).toBe(true);
    });
    expect(retireSpy.params.deviceId).toBe(DEVICE_ID);
    // Retiring keeps the record, so the page stays; only delete leaves it.
    expect(router.push).not.toHaveBeenCalled();
  });

  it("offers reinstate instead of retire on a retired device", async () => {
    const reinstateSpy = server.mount(contract.iot.reinstateIotDevice, {
      body: createIotDeviceDetail({ id: DEVICE_ID, status: "registered" }),
    });
    const user = userEvent.setup();
    const device = createIotDeviceDetail({ id: DEVICE_ID, status: "retired" });

    render(<DeviceHeaderActions device={device} />);

    await user.click(screen.getByRole("button", { name: /iot\.devices\.actions\.title/ }));
    expect(screen.queryByText("iot.devices.actions.retire")).not.toBeInTheDocument();
    await user.click(await screen.findByText("iot.devices.actions.reinstate"));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "iot.devices.actions.reinstate" }));

    await waitFor(() => {
      expect(reinstateSpy.called).toBe(true);
    });
    expect(reinstateSpy.params.deviceId).toBe(DEVICE_ID);
  });

  it("keeps the device in service and says so when retiring fails", async () => {
    server.mount(contract.iot.retireIotDevice, { status: 500 });
    const user = userEvent.setup();
    const device = createIotDeviceDetail({ id: DEVICE_ID, status: "active" });

    render(<DeviceHeaderActions device={device} />);

    await user.click(screen.getByRole("button", { name: /iot\.devices\.actions\.title/ }));
    await user.click(await screen.findByText("iot.devices.actions.retire"));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "iot.devices.actions.retire" }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "iot.devices.retire.error", variant: "destructive" }),
      );
    });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("says so when reinstating fails", async () => {
    server.mount(contract.iot.reinstateIotDevice, { status: 400 });
    const user = userEvent.setup();
    const device = createIotDeviceDetail({ id: DEVICE_ID, status: "retired" });

    render(<DeviceHeaderActions device={device} />);

    await user.click(screen.getByRole("button", { name: /iot\.devices\.actions\.title/ }));
    await user.click(await screen.findByText("iot.devices.actions.reinstate"));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "iot.devices.actions.reinstate" }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "iot.devices.reinstate.error", variant: "destructive" }),
      );
    });
  });

  it("closes the confirm without acting when cancelled", async () => {
    const retireSpy = server.mount(contract.iot.retireIotDevice);
    const user = userEvent.setup();
    const device = createIotDeviceDetail({ id: DEVICE_ID, status: "active" });

    render(<DeviceHeaderActions device={device} />);

    await user.click(screen.getByRole("button", { name: /iot\.devices\.actions\.title/ }));
    await user.click(await screen.findByText("iot.devices.actions.retire"));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "common.cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(retireSpy.called).toBe(false);
  });

  it("renders nothing below manage — deleting tears down real AWS hardware", () => {
    const device = createIotDeviceDetail({
      id: DEVICE_ID,
      capabilities: { ...readOnlyCapabilities, canLeave: true },
    });

    const { container } = render(<DeviceHeaderActions device={device} />);

    expect(container).toBeEmptyDOMElement();
  });
});
