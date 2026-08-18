import { createDeviceGroup } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { CreateDeviceGroupDialog } from "./create-device-group-dialog";

const push = vi.fn();

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push }),
}));

describe("CreateDeviceGroupDialog", () => {
  it("creates the group and routes to its detail page", async () => {
    const user = userEvent.setup();
    const group = createDeviceGroup({ name: "Greenhouse A" });
    const create = server.mount(contract.deviceGroups.createDeviceGroup, { body: group });
    server.mount(contract.deviceGroups.listDeviceGroups, { body: [group] });

    render(<CreateDeviceGroupDialog open onOpenChange={vi.fn()} locale="en-US" />);

    await user.type(screen.getByLabelText("iot.groups.nameLabel"), "Greenhouse A");
    await user.click(screen.getByText("iot.groups.create"));

    await vi.waitFor(() => {
      expect(create.calls).toHaveLength(1);
    });
    // An untouched description stays absent instead of arriving as "".
    expect(create.calls[0].body).toEqual({ name: "Greenhouse A" });
    expect(push).toHaveBeenCalledWith(`/en-US/platform/devices/groups/${group.id}`);
  });
});
