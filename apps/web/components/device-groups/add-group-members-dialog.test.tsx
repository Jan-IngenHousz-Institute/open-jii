import { createIotDevice } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { AddGroupMembersDialog } from "./add-group-members-dialog";

vi.mock("@repo/auth/client", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } } }),
}));

const GROUP_ID = "11111111-1111-4111-8111-111111111111";

describe("AddGroupMembersDialog", () => {
  it("offers only the caller's own devices that are not yet members", async () => {
    const mine = createIotDevice({ createdBy: "user-1", name: "Mine" });
    const alreadyMember = createIotDevice({ createdBy: "user-1", name: "Member" });
    const foreign = createIotDevice({ createdBy: "user-2", name: "Foreign" });
    server.mount(contract.iot.listIotDevices, { body: [mine, alreadyMember, foreign] });

    render(
      <AddGroupMembersDialog
        groupId={GROUP_ID}
        memberIds={[alreadyMember.id]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(await screen.findByText("Mine")).toBeInTheDocument();
    expect(screen.queryByText("Member")).not.toBeInTheDocument();
    expect(screen.queryByText("Foreign")).not.toBeInTheDocument();
  });

  it("submits the selection as one batch", async () => {
    const user = userEvent.setup();
    const mine = createIotDevice({ createdBy: "user-1", name: "Mine" });
    server.mount(contract.iot.listIotDevices, { body: [mine] });
    server.mount(contract.deviceGroups.listDeviceGroupMembers, { body: [] });
    server.mount(contract.deviceGroups.getDeviceGroup, { status: 404 });
    server.mount(contract.deviceGroups.listDeviceGroups, { body: [] });
    const add = server.mount(contract.deviceGroups.addDeviceGroupMembers, { body: [] });

    render(<AddGroupMembersDialog groupId={GROUP_ID} memberIds={[]} open onOpenChange={vi.fn()} />);

    await user.click(await screen.findByText("Mine"));
    await user.click(screen.getByText("iot.groups.addSelected"));

    await vi.waitFor(() => {
      expect(add.calls).toHaveLength(1);
    });
    expect(add.calls[0].body).toMatchObject({ deviceIds: [mine.id] });
  });

  it("says so when every device is already a member", async () => {
    const mine = createIotDevice({ createdBy: "user-1" });
    server.mount(contract.iot.listIotDevices, { body: [mine] });

    render(
      <AddGroupMembersDialog
        groupId={GROUP_ID}
        memberIds={[mine.id]}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(await screen.findByText("iot.groups.noAddableDevices")).toBeInTheDocument();
  });
});
