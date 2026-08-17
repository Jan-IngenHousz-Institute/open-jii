import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { useRouter } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { IotDevice } from "@repo/api/domains/iot/iot.schema";
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

  it("badges a private device, the way the other resource lists do", () => {
    renderRow(createIotDevice({ name: "Greenhouse 1", visibility: "private" }));

    expect(screen.getByText("resourceVisibility.privateStatus")).toBeInTheDocument();
  });

  it("leaves a public device unbadged", () => {
    renderRow(createIotDevice({ name: "Greenhouse 1", visibility: "public" }));

    // "Public" is the unremarkable default; only the exception is worth marking.
    expect(screen.queryByText("resourceVisibility.privateStatus")).not.toBeInTheDocument();
    expect(screen.queryByText("resourceVisibility.publicStatus")).not.toBeInTheDocument();
  });

  it("falls back to the serial number when the device is unnamed", () => {
    renderRow(createIotDevice({ name: null, deviceType: "multispeq", serialNumber: "SN-XYZ" }));

    // Name absent: the serial identifies the device where a shared product
    // name cannot distinguish forty unnamed units.
    expect(screen.getByRole("link", { name: "SN-XYZ" })).toBeInTheDocument();
  });

  it("falls back to the serial number for an unnamed generic device", () => {
    renderRow(createIotDevice({ name: null, deviceType: "generic", serialNumber: "SN-GEN" }));

    expect(screen.getByRole("link", { name: "SN-GEN" })).toBeInTheDocument();
  });

  it("shows measurement-device context for Ambit rows", () => {
    renderRow(createIotDevice({ name: null, deviceType: "ambit", serialNumber: "AMB-1" }));

    expect(screen.getByRole("link", { name: "AMB-1" })).toBeInTheDocument();
    expect(screen.getByText("iot.deviceIdentity.role.measurementDevice")).toBeInTheDocument();
  });

  it("shows gateway context for named Ambyte rows", () => {
    renderRow(createIotDevice({ name: "Field gateway", deviceType: "ambyte" }));

    expect(screen.getByRole("link", { name: "Field gateway" })).toBeInTheDocument();
    expect(screen.getByText("iot.deviceIdentity.role.gateway")).toBeInTheDocument();
    expect(screen.queryByText("iot.deviceIdentity.role.measurementDevice")).not.toBeInTheDocument();
  });

  it("keeps link clicks from also triggering row navigation", async () => {
    const router = vi.mocked(useRouter)();
    const user = userEvent.setup();
    renderRow(createIotDevice({ name: "Field gateway", deviceType: "ambyte" }));

    const link = screen.getByRole("link", { name: "Field gateway" });
    link.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(link);

    expect(router.push).not.toHaveBeenCalled();
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
