import { createResourceGrant } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { ResourceOverviewTabs } from "./resource-overview-tabs";

function renderTabs(overrides: Partial<React.ComponentProps<typeof ResourceOverviewTabs>> = {}) {
  return render(
    <ResourceOverviewTabs resourceType="macro" resourceId="macro-1" canShare {...overrides}>
      <p>The macro overview</p>
    </ResourceOverviewTabs>,
  );
}

describe("<ResourceOverviewTabs />", () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    server.mount(contract.sharing.listGrants, { body: [] });
  });

  it("renders the overview without a tab strip for a viewer who cannot share", () => {
    const listSpy = server.mount(contract.sharing.listGrants, { body: [] });

    renderTabs({ canShare: false });

    expect(screen.getByText("The macro overview")).toBeInTheDocument();
    // A lone "Overview" tab is not a tab strip worth showing...
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    // ...and the share-gated list is never requested.
    expect(listSpy.called).toBe(false);
  });

  it("gives a non-share grantee the tab with only the leave card, never the grants list", async () => {
    const user = userEvent.setup();
    const listSpy = server.mount(contract.sharing.listGrants, { body: [] });

    renderTabs({ canShare: false, canLeave: true });

    await user.click(screen.getByRole("tab", { name: "sharing.collaboratorsTab" }));

    expect(screen.getByText("sharing.yourAccessTitle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sharing.leaveAction/ })).toBeInTheDocument();
    // No grants surface for them: nothing to add with, and the share-gated
    // list is never requested.
    expect(
      screen.queryByRole("button", { name: /sharing.addCollaborator/ }),
    ).not.toBeInTheDocument();
    expect(listSpy.called).toBe(false);
  });

  it("shows the overview first and the collaborators surface behind its tab", async () => {
    const user = userEvent.setup();
    server.mount(contract.sharing.listGrants, {
      body: [
        createResourceGrant({
          resourceType: "macro",
          resourceId: "macro-1",
          grantee: { type: "user", displayName: "Lin Zhao", email: "lin@uni.edu", avatarUrl: null },
        }),
      ],
    });

    renderTabs();

    expect(screen.getByText("The macro overview")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "common.overview" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.queryByText("Lin Zhao")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "sharing.collaboratorsTab" }));

    await waitFor(() => expect(screen.getByText("Lin Zhao")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /sharing.addCollaborator/ })).toBeInTheDocument();
  });

  it("passes read-only through to the collaborators surface", async () => {
    const user = userEvent.setup();

    renderTabs({ readOnly: true });

    await user.click(screen.getByRole("tab", { name: "sharing.collaboratorsTab" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /sharing.addCollaborator/ })).toBeDisabled(),
    );
  });
});
