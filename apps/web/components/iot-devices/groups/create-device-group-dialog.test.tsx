import { createIotDeviceGroup, createMyOrganization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { CreateDeviceGroupDialog } from "./create-device-group-dialog";

const push = vi.fn();

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push }),
}));

describe("CreateDeviceGroupDialog", () => {
  it("closes on cancel without creating", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const create = server.mount(contract.iot.createIotDeviceGroup, { status: 500 });

    render(<CreateDeviceGroupDialog open onOpenChange={onOpenChange} locale="en-US" />);

    await user.click(screen.getByText("common.cancel"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(create.calls).toHaveLength(0);
  });

  it("creates the group and routes to its detail page", async () => {
    const user = userEvent.setup();
    const group = createIotDeviceGroup({ name: "Greenhouse A" });
    const create = server.mount(contract.iot.createIotDeviceGroup, { body: group });
    server.mount(contract.iot.listIotDeviceGroups, { body: [group] });

    render(<CreateDeviceGroupDialog open onOpenChange={vi.fn()} locale="en-US" />);

    expect(
      screen.getByRole("button", { name: "iot.groups.create" }).querySelector(".lucide-plus"),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("iot.groups.nameLabel"), "Greenhouse A");
    await user.click(screen.getByText("iot.groups.create"));

    await vi.waitFor(() => {
      expect(create.calls).toHaveLength(1);
    });
    // An untouched description stays absent instead of arriving as "".
    expect(create.calls[0].body).toEqual({ name: "Greenhouse A" });
    expect(push).toHaveBeenCalledWith(`/en-US/platform/devices/groups/${group.id}`);
  });

  it("creates the group into the chosen organization, so its members can see it", async () => {
    const user = userEvent.setup();
    // The picker's query is principal-scoped, so it needs a signed-in caller.
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    const personal = createMyOrganization({
      id: "11111111-1111-4111-8111-111111111111",
      isPersonal: true,
    });
    const shared = createMyOrganization({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Greenhouse Lab",
    });
    server.mount(contract.organizations.listMyOrganizations, { body: [personal, shared] });
    const group = createIotDeviceGroup({ name: "Greenhouse A" });
    const create = server.mount(contract.iot.createIotDeviceGroup, { body: group });
    server.mount(contract.iot.listIotDeviceGroups, { body: [group] });

    render(<CreateDeviceGroupDialog open onOpenChange={vi.fn()} locale="en-US" />);

    await user.type(screen.getByLabelText("iot.groups.nameLabel"), "Greenhouse A");
    await user.click(await screen.findByRole("combobox", { name: "organizations.picker.label" }));
    await user.click(await screen.findByRole("option", { name: "Greenhouse Lab" }));
    await user.click(screen.getByText("iot.groups.create"));

    await vi.waitFor(() => {
      expect(create.calls).toHaveLength(1);
    });
    // Without this the group lands in the creator's personal workspace and the
    // organization's other members never see it.
    expect(create.calls[0].body).toEqual({
      name: "Greenhouse A",
      organizationId: "22222222-2222-4222-8222-222222222222",
    });
  });
});
