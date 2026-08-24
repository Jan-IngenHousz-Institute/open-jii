import {
  createDeviceGroupDetail,
  createDeviceGroupMember,
  readOnlyCapabilities,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { DeviceGroupContent } from "./device-group-content";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useParams: () => ({ groupId: GROUP_ID }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@repo/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } } }),
}));

function mountGroup(overrides = {}, members = [createDeviceGroupMember()]) {
  server.mount(contract.iot.getIotDeviceGroup, {
    body: createDeviceGroupDetail({ id: GROUP_ID, name: "Greenhouse A", ...overrides }),
  });
  server.mount(contract.iot.listIotDeviceGroupMembers, { body: members });
  server.mount(contract.iot.listIotDevices, { body: [] });
}

describe("DeviceGroupContent", () => {
  it("shows the roster with the shallow member row", async () => {
    mountGroup({}, [
      createDeviceGroupMember({ name: null, serialNumber: "E8:F6:0A", deviceType: "ambyte" }),
    ]);

    render(<DeviceGroupContent />);

    // Unnamed devices lead with their identifier, like everywhere else.
    // Name resolves to the serial for an unnamed device AND the serial renders as
    // its own second line, so the value legitimately appears twice.
    expect((await screen.findAllByText(/E8:F6:0A/)).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /E8:F6:0A/ })).toBeInTheDocument();
    expect(screen.getByText("iot.devices.status.active")).toBeInTheDocument();
  });

  it("offers add and remove to contributors", async () => {
    mountGroup();

    render(<DeviceGroupContent />);

    expect(await screen.findByText("iot.groups.addDevices")).toBeInTheDocument();
    expect(screen.getByText("iot.groups.remove")).toBeInTheDocument();
  });

  it("hides membership controls from read-only viewers", async () => {
    mountGroup({ capabilities: { ...readOnlyCapabilities } });

    render(<DeviceGroupContent />);

    expect((await screen.findAllByText(/AA:BB:CC:DD/)).length).toBeGreaterThan(0);
    expect(screen.queryByText("iot.groups.addDevices")).not.toBeInTheDocument();
    expect(screen.queryByText("iot.groups.remove")).not.toBeInTheDocument();
  });

  it("removes a member", async () => {
    const user = userEvent.setup();
    mountGroup();
    const remove = server.mount(contract.iot.removeIotDeviceGroupMember, { status: 204 });

    render(<DeviceGroupContent />);

    await user.click(await screen.findByText("iot.groups.remove"));
    await vi.waitFor(() => {
      expect(remove.calls).toHaveLength(1);
    });
  });

  it("opens the add-devices dialog from the actions row", async () => {
    const user = userEvent.setup();
    mountGroup();

    render(<DeviceGroupContent />);

    await user.click(await screen.findByText("iot.groups.addDevices"));
    expect(await screen.findByText("iot.groups.addDevicesTitle")).toBeInTheDocument();
  });

  it("surfaces a load error", async () => {
    server.mount(contract.iot.getIotDeviceGroup, { status: 500 });
    server.mount(contract.iot.listIotDeviceGroupMembers, { body: [] });

    render(<DeviceGroupContent />);

    expect(await screen.findByText("iot.groups.loadError")).toBeInTheDocument();
  });

  it("shows the empty roster hint", async () => {
    mountGroup({}, []);

    render(<DeviceGroupContent />);

    expect(await screen.findByText("iot.groups.noMembers")).toBeInTheDocument();
  });
});
