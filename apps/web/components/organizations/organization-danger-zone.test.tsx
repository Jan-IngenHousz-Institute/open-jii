import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { OrganizationDeletionBlocker } from "@repo/api/domains/organization/organization.schema";
import { authClient, useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { OrganizationDangerZone } from "./organization-danger-zone";

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

/** The authoritative blocker read: every owned type, counts only. */
function mountBlockers(blockers: OrganizationDeletionBlocker[]) {
  return server.mount(contract.organizations.getOrganizationDeletionBlockers, {
    body: { blockers, total: blockers.reduce((sum, { count }) => sum + count, 0) },
  });
}

const deleteOrganization = () => vi.mocked(authClient.organization.delete);

function renderDangerZone() {
  return render(
    <OrganizationDangerZone organizationId="org-1" organizationName="Greenhouse Lab" />,
  );
}

describe("<OrganizationDangerZone />", () => {
  afterEach(() => {
    mockSession(null);
    deleteOrganization().mockResolvedValue({ data: null, error: null });
  });

  it("disables deletion with the reason while the organization still owns resources", async () => {
    mockSession({ id: "user-1" });
    mountBlockers([
      { resourceType: "experiment", count: 2 },
      { resourceType: "workbook", count: 1 },
    ]);

    renderDangerZone();

    // The reason is stated, not hidden: the block has a clear remedy, and hiding
    // the control would read as a missing feature instead of a precondition. Awaited
    // rather than asserted outright, because a disabled button on its own is also
    // what an unresolved count looks like.
    expect(await screen.findByText("organizations.delete.blockedReason")).toBeVisible();
    expect(screen.getByRole("button", { name: "organizations.delete.action" })).toBeDisabled();
  });

  /**
   * The finding this read exists for. It used to be that devices were absent from the
   * resources showcase entirely; they are listed there now, so the difference that still
   * matters is scoping — the showcase counts what *this caller* may read, while the
   * server's delete guard counts the organization's whole estate. Deriving the block
   * from the showcase offered an enabled Delete that failed only after the confirmation.
   */
  it("blocks on devices, which the caller-scoped showcase can under-report", async () => {
    mockSession({ id: "user-1" });
    mountBlockers([{ resourceType: "device", count: 1 }]);

    renderDangerZone();

    expect(await screen.findByText("organizations.delete.blockedReason")).toBeVisible();
    expect(screen.getByRole("button", { name: "organizations.delete.action" })).toBeDisabled();
  });

  it("asks the blocker read rather than the resources showcase", async () => {
    mockSession({ id: "user-1" });
    const blockerSpy = mountBlockers([]);
    const showcaseSpy = server.mount(contract.organizations.listOrganizationResources, {
      body: { resources: [] },
    });

    renderDangerZone();

    await waitFor(() => {
      expect(blockerSpy.called).toBe(true);
    });
    // The showcase is access-scoped, so it cannot answer this question.
    expect(showcaseSpy.called).toBe(false);
  });

  it("enables deletion once the organization is empty", async () => {
    mockSession({ id: "user-1" });
    mountBlockers([]);

    renderDangerZone();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "organizations.delete.action" })).toBeEnabled();
    });
    expect(screen.queryByText("organizations.delete.blockedReason")).not.toBeInTheDocument();
  });

  it("keeps deletion disabled while the count is still unresolved", () => {
    mockSession({ id: "user-1" });
    server.mount(contract.organizations.getOrganizationDeletionBlockers, { delay: "infinite" });

    renderDangerZone();

    // Unresolved is not "unblocked": offering it here invites a click the server
    // is about to refuse.
    expect(screen.getByRole("button", { name: "organizations.delete.action" })).toBeDisabled();
    expect(screen.queryByText("organizations.delete.blockedReason")).not.toBeInTheDocument();
  });

  it("keeps deletion disabled when the count could not be read, and offers a retry", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    const blockerSpy = server.mount(contract.organizations.getOrganizationDeletionBlockers, {
      status: 500,
    });

    renderDangerZone();

    // A failed read is unresolved for good: without it, `total ?? 0` reads as an
    // empty organization and the confirmation offers what the server will refuse.
    await waitFor(() =>
      expect(screen.getByText("organizations.delete.blockersLoadFailed")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "organizations.delete.action" })).toBeDisabled();

    const attempts = blockerSpy.callCount;
    await user.click(screen.getByRole("button", { name: "errors.tryAgain" }));
    await waitFor(() => expect(blockerSpy.callCount).toBeGreaterThan(attempts));
  });

  it("deletes after confirmation and leaves the organization's routes", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    mountBlockers([]);

    const { router } = renderDangerZone();

    await user.click(await screen.findByRole("button", { name: "organizations.delete.action" }));
    await user.click(screen.getByRole("button", { name: "organizations.delete.action" }));

    await waitFor(() => {
      expect(deleteOrganization()).toHaveBeenCalledWith({ organizationId: "org-1" });
    });
    expect(vi.mocked(router.push)).toHaveBeenCalledWith("/en-US/platform/organizations");
  });

  it("surfaces the server's own refusal when the count and the guard race", async () => {
    const user = userEvent.setup();
    mockSession({ id: "user-1" });
    // The blocker read and the delete guard are two separate queries, so a resource
    // transferred in between them still lands as a refusal. The server's count is
    // the authority and its message says what is left.
    mountBlockers([]);
    deleteOrganization().mockResolvedValue({
      data: null,
      error: { message: "This organization still owns 3 resources (3 experiments)." },
    });

    renderDangerZone();

    await user.click(await screen.findByRole("button", { name: "organizations.delete.action" }));
    await user.click(screen.getByRole("button", { name: "organizations.delete.action" }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "This organization still owns 3 resources (3 experiments).",
          variant: "destructive",
        }),
      );
    });
  });
});
