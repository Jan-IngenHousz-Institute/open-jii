import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { useRouter } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { LeaveResourceCard } from "./leave-resource-card";

function renderCard(overrides: Partial<React.ComponentProps<typeof LeaveResourceCard>> = {}) {
  return render(<LeaveResourceCard resourceType="macro" resourceId="macro-1" {...overrides} />);
}

describe("<LeaveResourceCard />", () => {
  it("confirms before leaving, then leaves and redirects to the resource list", async () => {
    const user = userEvent.setup();
    const leaveSpy = server.mount(contract.sharing.leaveResource);

    renderCard();

    await user.click(screen.getByRole("button", { name: /sharing.leaveAction/ }));

    // Same confirm as the row-based self-revoke: what is lost is your own
    // access, with the caveat that access may survive by another route.
    expect(screen.getByText("sharing.leaveTitle")).toBeInTheDocument();
    expect(screen.getByText("sharing.leaveOtherAccessWarning")).toBeInTheDocument();
    expect(leaveSpy.called).toBe(false);

    await user.click(screen.getByRole("button", { name: "sharing.leaveConfirm" }));

    await waitFor(() => expect(leaveSpy.called).toBe(true));
    expect(leaveSpy.params).toMatchObject({ resourceType: "macro", id: "macro-1" });
    expect(vi.mocked(toast)).toHaveBeenCalledWith({ description: "sharing.leftResource" });
    expect(useRouter().push).toHaveBeenCalledWith("/en-US/platform/macros");
  });

  it("does not leave when the confirm is cancelled", async () => {
    const user = userEvent.setup();
    const leaveSpy = server.mount(contract.sharing.leaveResource);

    renderCard();

    await user.click(screen.getByRole("button", { name: /sharing.leaveAction/ }));
    await user.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(leaveSpy.called).toBe(false);
    expect(useRouter().push).not.toHaveBeenCalled();
  });

  it("surfaces the server's refusal and stays put", async () => {
    const user = userEvent.setup();
    server.mount(contract.sharing.leaveResource, {
      status: 400,
      body: { message: "Cannot remove the last admin from the experiment" },
    });

    renderCard({ resourceType: "experiment", resourceId: "exp-1" });

    await user.click(screen.getByRole("button", { name: /sharing.leaveAction/ }));
    await user.click(screen.getByRole("button", { name: "sharing.leaveConfirm" }));

    await waitFor(() =>
      expect(vi.mocked(toast)).toHaveBeenCalledWith({
        description: "Cannot remove the last admin from the experiment",
        variant: "destructive",
      }),
    );
    expect(useRouter().push).not.toHaveBeenCalled();
  });

  it("locks the leave action when disabled (e.g. archived)", () => {
    renderCard({ disabled: true });
    expect(screen.getByRole("button", { name: /sharing.leaveAction/ })).toBeDisabled();
  });
});
