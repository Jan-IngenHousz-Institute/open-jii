import { createIotDeviceDetail, readOnlyCapabilities } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { DeviceHeaderActions } from "./device-header-actions";

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

describe("DeviceHeaderActions", () => {
  it("deletes through the overflow menu after a confirm, then leaves the page", async () => {
    const deleteSpy = server.mount(contract.iot.deleteIotDevice);
    const user = userEvent.setup();
    const device = createIotDeviceDetail({ id: DEVICE_ID, name: "Doomed" });

    const { router } = render(<DeviceHeaderActions device={device} />);

    await user.click(screen.getByRole("button", { name: "iot.devices.actions.more" }));
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

  it("renders nothing below manage — deleting tears down real AWS hardware", () => {
    const device = createIotDeviceDetail({
      id: DEVICE_ID,
      capabilities: { ...readOnlyCapabilities, canLeave: true },
    });

    const { container } = render(<DeviceHeaderActions device={device} />);

    expect(container).toBeEmptyDOMElement();
  });
});
