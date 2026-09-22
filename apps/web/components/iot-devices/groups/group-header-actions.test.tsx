import { createDeviceGroupDetail, readOnlyCapabilities } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { GroupHeaderActions } from "./group-header-actions";

describe("GroupHeaderActions", () => {
  it("deletes through the overflow menu after a confirm, then leaves the page", async () => {
    const remove = server.mount(contract.iot.deleteIotDeviceGroup, { status: 204 });
    const user = userEvent.setup();
    const group = createDeviceGroupDetail({ name: "Field fleet" });

    const { router } = render(<GroupHeaderActions group={group} />);

    await user.click(screen.getByRole("button", { name: /iot\.devices\.actions\.title/ }));
    await user.click(await screen.findByText("iot.groups.deleteTitle"));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByText("iot.groups.delete"));

    await vi.waitFor(() => {
      expect(remove.calls).toHaveLength(1);
    });
    await waitFor(() => {
      expect(router.push).toHaveBeenCalled();
    });
  });

  it("renders nothing below manage", () => {
    const group = createDeviceGroupDetail({ capabilities: { ...readOnlyCapabilities } });

    const { container } = render(<GroupHeaderActions group={group} />);

    expect(container).toBeEmptyDOMElement();
  });
});
