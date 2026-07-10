import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { IotDeviceDetail } from "./iot-device-detail";

describe("IotDeviceDetail", () => {
  it("renders the device identity and the credentials placeholder", async () => {
    const device = createIotDevice({
      name: "Field Sensor",
      serialNumber: "SN-42",
      deviceType: "ambyte",
    });
    server.mount(contract.iot.getIotDevice, { body: device });

    render(<IotDeviceDetail deviceId={device.id} />);

    expect(await screen.findByRole("heading", { name: "Field Sensor" })).toBeInTheDocument();
    expect(screen.getByText("SN-42")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.detail.credentials.none")).toBeInTheDocument();
  });

  it("deletes from the danger zone and navigates back to the list", async () => {
    const device = createIotDevice({ name: "Doomed" });
    server.mount(contract.iot.getIotDevice, { body: device });
    const spy = server.mount(contract.iot.deleteIotDevice);
    const user = userEvent.setup();

    const { router } = render(<IotDeviceDetail deviceId={device.id} />);
    await screen.findByRole("heading", { name: "Doomed" });

    await user.click(screen.getByRole("button", { name: "iot.devices.actions.delete" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "iot.devices.actions.delete" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params.deviceId).toBe(device.id);
    await waitFor(() => expect(router.push).toHaveBeenCalled());
  });
});
