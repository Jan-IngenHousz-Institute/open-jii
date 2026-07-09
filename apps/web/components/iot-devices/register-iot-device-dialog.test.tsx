import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { RegisterIotDeviceDialog } from "./register-iot-device-dialog";

describe("RegisterIotDeviceDialog", () => {
  it("registers a device and closes on success", async () => {
    const onOpenChange = vi.fn();
    const spy = server.mount(contract.iot.registerIotDevice, {
      body: createIotDevice({ serialNumber: "AA:BB:CC", deviceType: "ambyte" }),
    });
    const user = userEvent.setup();

    render(<RegisterIotDeviceDialog open onOpenChange={onOpenChange} />);

    await user.type(screen.getByPlaceholderText("devices.dialog.serialPlaceholder"), "AA:BB:CC");
    await user.type(screen.getByPlaceholderText("devices.dialog.typePlaceholder"), "ambyte");
    await user.click(screen.getByRole("button", { name: "devices.dialog.submit" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({ serialNumber: "AA:BB:CC", deviceType: "ambyte" });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "devices.dialog.createSuccess" }),
    );
  });

  it("does not submit when required fields are empty", async () => {
    const spy = server.mount(contract.iot.registerIotDevice, { body: createIotDevice() });
    const user = userEvent.setup();

    render(<RegisterIotDeviceDialog open onOpenChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "devices.dialog.submit" }));

    expect(await screen.findAllByText(/at least 1 character/i)).not.toHaveLength(0);
    expect(spy.called).toBe(false);
  });

  it("omits a blank name from the request body", async () => {
    const spy = server.mount(contract.iot.registerIotDevice, { body: createIotDevice() });
    const user = userEvent.setup();

    render(<RegisterIotDeviceDialog open onOpenChange={vi.fn()} />);
    await user.type(screen.getByPlaceholderText("devices.dialog.serialPlaceholder"), "AA:BB");
    await user.type(screen.getByPlaceholderText("devices.dialog.typePlaceholder"), "ambyte");
    await user.click(screen.getByRole("button", { name: "devices.dialog.submit" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).not.toHaveProperty("name");
  });
});
