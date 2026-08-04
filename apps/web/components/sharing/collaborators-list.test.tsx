import { createResourceGrant, createResourceOwner } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type {
  ResourceCollaboratorDto,
  ResourceGrantDto,
  ResourceOwnerDto,
} from "@repo/api/domains/sharing/sharing.schema";
import { useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

import { CollaboratorsList } from "./collaborators-list";

/** Point the globally-mocked `useSession` at a given principal. */
function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

function renderList(
  grants: ResourceCollaboratorDto[],
  overrides: Partial<React.ComponentProps<typeof CollaboratorsList>> = {},
) {
  return render(
    <CollaboratorsList
      resourceType="experiment"
      resourceId="exp-1"
      grants={grants}
      {...overrides}
    />,
  );
}

/**
 * The row element for a grantee, so per-row controls can be queried
 * unambiguously — the i18n mock returns raw keys, so every row's role select and
 * revoke button share the same accessible name.
 */
function rowFor(name: string): HTMLElement {
  const row = screen.getByText(name).closest('[role="listitem"]');
  if (!row) throw new Error(`No collaborator row found for ${name}`);
  return row as HTMLElement;
}

function grantFor(name: string, overrides: Partial<ResourceGrantDto> = {}): ResourceGrantDto {
  return createResourceGrant({
    resourceType: "experiment",
    resourceId: "exp-1",
    grantee: { type: "user", displayName: name, email: null, avatarUrl: null },
    ...overrides,
  });
}

describe("<CollaboratorsList />", () => {
  afterEach(() => {
    // Restore the suite-wide default (signed out, session resolved).
    mockSession(null);
  });

  it("shows an empty state when the resource has no direct grants", () => {
    renderList([]);

    expect(screen.getByText("sharing.noCollaboratorsYet")).toBeInTheDocument();
    expect(screen.getByText("sharing.noCollaboratorsHint")).toBeInTheDocument();
  });

  it("shows placeholders rather than the empty state while the list is still loading", () => {
    const { container } = renderList([], { isPending: true });

    // "No collaborators yet" is a claim about the resource, and an empty `grants`
    // array does not support it until the request has answered.
    expect(screen.queryByText("sharing.noCollaboratorsYet")).not.toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  describe("owner rows", () => {
    function ownerFor(name: string): ResourceOwnerDto {
      return createResourceOwner({
        grantee: { type: "user", displayName: name, email: null, avatarUrl: null },
      });
    }

    it("renders an owner as a static badge with nothing to change or revoke", () => {
      renderList([ownerFor("Ada Owner")]);

      const row = rowFor("Ada Owner");
      expect(within(row).getByText("sharing.ownerBadge")).toBeInTheDocument();
      // An owner holds full control through the organization, so there is no tier
      // to move them between and no grant to take away.
      expect(within(row).queryByRole("combobox")).not.toBeInTheDocument();
      expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    });

    it("sorts owners above grants, including above the signed-in user's own row", () => {
      mockSession({ id: "me" });
      renderList([
        grantFor("Lin Zhao", { granteeId: "me" }),
        grantFor("Other Person"),
        ownerFor("Ada Owner"),
      ]);

      const names = screen
        .getAllByRole("listitem")
        .map((row) => within(row).getByRole("heading").textContent);
      expect(names).toEqual(["Ada Owner", "Lin Zhao", "Other Person"]);
    });

    it("gives an owner no leave affordance even when they are the signed-in user", () => {
      mockSession({ id: "me" });
      renderList([createResourceOwner({ granteeId: "me" })]);

      // Leaving what you own is an organization matter, not a resource one.
      expect(screen.queryByRole("button", { name: "sharing.leaveAction" })).not.toBeInTheDocument();
    });
  });

  it("distinguishes an empty filter result from an empty resource", () => {
    renderList([], { isFiltered: true });

    expect(screen.getByText("sharing.noMatchingCollaborators")).toBeInTheDocument();
    expect(screen.queryByText("sharing.noCollaboratorsYet")).not.toBeInTheDocument();
  });

  it("reports a failed list request instead of claiming there are no collaborators", () => {
    renderList([], { isError: true });

    expect(screen.getByText("sharing.loadFailed")).toBeInTheDocument();
    expect(screen.queryByText("sharing.noCollaboratorsYet")).not.toBeInTheDocument();
  });

  it("labels grantees who are not members of the owning organization", () => {
    renderList([
      grantFor("Asha Okafor", {
        id: "g-inside",
        granteeId: "u-inside",
        isOutsideCollaborator: false,
      }),
      grantFor("Lin Zhao", {
        id: "g-outside",
        granteeId: "u-outside",
        isOutsideCollaborator: true,
      }),
    ]);

    expect(within(rowFor("Lin Zhao")).getByText("sharing.outsideCollaborator")).toBeInTheDocument();
    expect(
      within(rowFor("Asha Okafor")).queryByText("sharing.outsideCollaborator"),
    ).not.toBeInTheDocument();
  });

  it("labels an organization grantee as such", () => {
    renderList([
      createResourceGrant({
        granteeType: "organization",
        isOutsideCollaborator: true,
        grantee: { type: "organization", displayName: "Partner Lab", email: null, avatarUrl: null },
      }),
    ]);

    const row = rowFor("Partner Lab");
    expect(within(row).getByText("sharing.granteeTypeOrganization")).toBeInTheDocument();
    expect(within(row).getByText("sharing.outsideCollaborator")).toBeInTheDocument();
  });

  describe("tier collapse", () => {
    it("displays the three API roles under the two tiers the UI offers", () => {
      renderList([
        grantFor("Owner Grant", { role: "owner" }),
        grantFor("Admin Grant", { role: "admin" }),
        grantFor("Viewer Grant", { role: "viewer" }),
      ]);

      expect(within(rowFor("Owner Grant")).getByRole("combobox")).toHaveTextContent(
        "sharing.roleCanEdit",
      );
      expect(within(rowFor("Admin Grant")).getByRole("combobox")).toHaveTextContent(
        "sharing.roleCanEdit",
      );
      expect(within(rowFor("Viewer Grant")).getByRole("combobox")).toHaveTextContent(
        "sharing.roleCanView",
      );
    });

    it("offers only the two tiers, never the collapsed-away roles", async () => {
      const user = userEvent.setup();
      renderList([grantFor("Lin Zhao", { role: "owner" })]);

      await user.click(within(rowFor("Lin Zhao")).getByRole("combobox"));

      expect(screen.getAllByRole("option")).toHaveLength(2);
      expect(screen.getByRole("option", { name: "sharing.roleCanEdit" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "sharing.roleCanView" })).toBeInTheDocument();
    });

    it("writes the raised tier through the update endpoint", async () => {
      const user = userEvent.setup();
      const grant = grantFor("Lin Zhao", { id: "g-1", role: "viewer" });
      const updateSpy = server.mount(contract.sharing.updateGrant, {
        body: [{ ...grant, role: "admin" }],
      });

      renderList([grant]);

      await user.click(within(rowFor("Lin Zhao")).getByRole("combobox"));
      await user.click(screen.getByRole("option", { name: "sharing.roleCanEdit" }));

      await waitFor(() => expect(updateSpy.called).toBe(true));
      expect(updateSpy.body).toEqual({ role: "admin" });
      expect(updateSpy.params).toMatchObject({
        resourceType: "experiment",
        id: "exp-1",
        grantId: "g-1",
      });
    });
  });

  it("warns that access may persist before revoking, and only revokes on confirm", async () => {
    const user = userEvent.setup();
    const revokeSpy = server.mount(contract.sharing.revokeGrant);

    renderList([grantFor("Lin Zhao", { id: "g-1" })]);

    await user.click(
      within(rowFor("Lin Zhao")).getByRole("button", { name: "sharing.revokeForLabel" }),
    );

    // Revoking one grant does not guarantee the grantee loses access.
    expect(screen.getByText("sharing.revokeTitle")).toBeInTheDocument();
    expect(screen.getByText("sharing.revokeOtherAccessWarning")).toBeInTheDocument();

    // Cancelling leaves the grant alone.
    await user.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(revokeSpy.called).toBe(false);

    await user.click(
      within(rowFor("Lin Zhao")).getByRole("button", { name: "sharing.revokeForLabel" }),
    );
    await user.click(screen.getByRole("button", { name: "sharing.revokeConfirm" }));

    await waitFor(() => expect(revokeSpy.called).toBe(true));
    expect(revokeSpy.params).toMatchObject({
      resourceType: "experiment",
      id: "exp-1",
      grantId: "g-1",
    });
  });

  it("closes an open revoke dialog when the surface goes read-only mid-session", async () => {
    const user = userEvent.setup();
    const revokeSpy = server.mount(contract.sharing.revokeGrant);
    const grants = [grantFor("Lin Zhao", { id: "g-1" })];

    const { rerender } = renderList(grants);

    await user.click(
      within(rowFor("Lin Zhao")).getByRole("button", { name: "sharing.revokeForLabel" }),
    );
    expect(screen.getByText("sharing.revokeTitle")).toBeInTheDocument();

    // The experiment is archived elsewhere and the refetch lands read-only while
    // the dialog is open — it must stop being a live confirm path.
    rerender(
      <CollaboratorsList resourceType="experiment" resourceId="exp-1" grants={grants} readOnly />,
    );

    await waitFor(() => expect(screen.queryByText("sharing.revokeTitle")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "sharing.revokeConfirm" })).not.toBeInTheDocument();
    expect(revokeSpy.called).toBe(false);
  });

  it("locks every row control when read-only", () => {
    renderList([grantFor("Lin Zhao")], { readOnly: true });

    const row = rowFor("Lin Zhao");
    expect(within(row).getByRole("combobox")).toBeDisabled();
    expect(within(row).getByRole("button", { name: "sharing.revokeForLabel" })).toBeDisabled();
  });

  describe("staffing refusals", () => {
    it("surfaces the server's refusal when the last admin is demoted", async () => {
      const user = userEvent.setup();
      const grant = grantFor("Lin Zhao", { id: "g-1", role: "admin" });
      server.mount(contract.sharing.updateGrant, {
        status: 409,
        body: { message: "An experiment must keep at least one admin" },
      });

      renderList([grant]);

      await user.click(within(rowFor("Lin Zhao")).getByRole("combobox"));
      await user.click(screen.getByRole("option", { name: "sharing.roleCanView" }));

      await waitFor(() =>
        expect(vi.mocked(toast)).toHaveBeenCalledWith({
          description: "An experiment must keep at least one admin",
          variant: "destructive",
        }),
      );
      // The row keeps showing what the server still holds.
      expect(within(rowFor("Lin Zhao")).getByRole("combobox")).toHaveTextContent(
        "sharing.roleCanEdit",
      );
    });

    it("surfaces the server's refusal when the last admin is removed", async () => {
      const user = userEvent.setup();
      server.mount(contract.sharing.revokeGrant, {
        status: 409,
        body: { message: "An experiment must keep at least one admin" },
      });

      renderList([grantFor("Lin Zhao", { id: "g-1", role: "admin" })]);

      await user.click(
        within(rowFor("Lin Zhao")).getByRole("button", { name: "sharing.revokeForLabel" }),
      );
      await user.click(screen.getByRole("button", { name: "sharing.revokeConfirm" }));

      await waitFor(() =>
        expect(vi.mocked(toast)).toHaveBeenCalledWith({
          description: "An experiment must keep at least one admin",
          variant: "destructive",
        }),
      );
      // A refused revoke leaves the dialog open so the reason can be read.
      expect(screen.getByText("sharing.revokeTitle")).toBeInTheDocument();
    });
  });

  describe("self-revoke", () => {
    it("marks the signed-in user's own grant and sorts it first", () => {
      mockSession({ id: "self-user" });

      renderList([
        grantFor("Asha Okafor", { id: "g-other", granteeId: "other-user" }),
        grantFor("Lin Zhao", { id: "g-self", granteeId: "self-user" }),
      ]);

      const rows = screen.getAllByRole("listitem");
      expect(within(rows[0]).getByText("Lin Zhao")).toBeInTheDocument();
      expect(within(rowFor("Lin Zhao")).getByText("sharing.you")).toBeInTheDocument();
      expect(within(rowFor("Asha Okafor")).queryByText("sharing.you")).not.toBeInTheDocument();
    });

    it("asks to confirm leaving, with the caveat that other access may remain", async () => {
      const user = userEvent.setup();
      mockSession({ id: "self-user" });
      const revokeSpy = server.mount(contract.sharing.revokeGrant);

      renderList([grantFor("Lin Zhao", { id: "g-self", granteeId: "self-user", role: "admin" })]);

      await user.click(
        within(rowFor("Lin Zhao")).getByRole("button", { name: "sharing.leaveAction" }),
      );

      expect(screen.getByText("sharing.leaveTitle")).toBeInTheDocument();
      expect(screen.getByText("sharing.leaveOtherAccessWarning")).toBeInTheDocument();
      expect(screen.queryByText("sharing.revokeTitle")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "sharing.leaveConfirm" }));

      await waitFor(() => expect(revokeSpy.called).toBe(true));
      expect(revokeSpy.params).toMatchObject({ grantId: "g-self" });
    });

    it("reports leaving in its own words, not as removing a collaborator", async () => {
      const user = userEvent.setup();
      mockSession({ id: "self-user" });
      server.mount(contract.sharing.revokeGrant);

      renderList([grantFor("Lin Zhao", { id: "g-self", granteeId: "self-user" })]);

      await user.click(
        within(rowFor("Lin Zhao")).getByRole("button", { name: "sharing.leaveAction" }),
      );
      await user.click(screen.getByRole("button", { name: "sharing.leaveConfirm" }));

      await waitFor(() =>
        expect(vi.mocked(toast)).toHaveBeenCalledWith({ description: "sharing.leftResource" }),
      );
    });

    it("keeps the revoke wording for someone else's grant", async () => {
      const user = userEvent.setup();
      mockSession({ id: "self-user" });
      server.mount(contract.sharing.revokeGrant);

      renderList([grantFor("Asha Okafor", { id: "g-other", granteeId: "another-user" })]);

      await user.click(
        within(rowFor("Asha Okafor")).getByRole("button", { name: "sharing.revokeForLabel" }),
      );
      await user.click(screen.getByRole("button", { name: "sharing.revokeConfirm" }));

      await waitFor(() =>
        expect(vi.mocked(toast)).toHaveBeenCalledWith({
          description: "sharing.collaboratorRevoked",
        }),
      );
    });
  });
});
