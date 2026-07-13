import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { IotDevice } from "@repo/api/schemas/iot.schema";
import { Table, TableBody } from "@repo/ui/components/table";
import { toast } from "@repo/ui/hooks/use-toast";

import { IotDeviceTableRow } from "./iot-device-table-row";

function renderRow(device: IotDevice) {
  return render(
    <Table>
      <TableBody>
        <IotDeviceTableRow device={device} />
      </TableBody>
    </Table>,
  );
}

describe("IotDeviceTableRow", () => {
  it("links the device name and shows its status", () => {
    renderRow(createIotDevice({ name: "Greenhouse 1", status: "active" }));

    expect(screen.getByRole("link", { name: "Greenhouse 1" })).toBeInTheDocument();
    expect(screen.getByText("iot.devices.status.active")).toBeInTheDocument();
  });

  it("falls back to the serial number when the device is unnamed", () => {
    renderRow(createIotDevice({ name: null, serialNumber: "SN-XYZ" }));

    expect(screen.getByRole("link", { name: "SN-XYZ" })).toBeInTheDocument();
  });

  it("deletes the device and toasts on confirm", async () => {
    const device = createIotDevice({ name: "Sensor A" });
    const spy = server.mount(contract.iot.deleteIotDevice);
    const user = userEvent.setup();

    renderRow(device);

    await user.click(screen.getByRole("button", { name: "iot.devices.actions.more" }));
    await user.click(await screen.findByRole("menuitem", { name: "iot.devices.actions.delete" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "iot.devices.actions.delete" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params.deviceId).toBe(device.id);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "iot.devices.remove.success" }),
      ),
    );
  });
});
