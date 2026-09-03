import { createResourceGrant } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ResourceGrantDto } from "@repo/api/domains/sharing/sharing.schema";
import { useSession } from "@repo/auth/client";

import { CollaboratorsList } from "./collaborators-list";
import { GranteePicker } from "./grantee-picker";

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

function teamGrant(overrides: Partial<ResourceGrantDto> = {}): ResourceGrantDto {
  return createResourceGrant({
    granteeType: "team",
    granteeId: "team-1",
    role: "admin",
    grantee: {
      type: "team",
      displayName: "Imaging",
      email: null,
      avatarUrl: null,
      memberCount: 4,
    },
    ...overrides,
  });
}

function rowFor(name: string): HTMLElement {
  const row = screen.getByText(name).closest('[role="listitem"]');
  if (!row) throw new Error(`No collaborator row found for ${name}`);
  return row as HTMLElement;
}

describe("team grantees in the collaborators surface", () => {
  afterEach(() => {
    mockSession(null);
  });

  describe("rows", () => {
    function renderList(grants: ResourceGrantDto[]) {
      return render(
        <CollaboratorsList resourceType="experiment" resourceId="exp-1" grants={grants} />,
      );
    }

    it("labels a team row and shows how many people the grant admits", () => {
      renderList([teamGrant()]);

      const row = within(rowFor("Imaging"));
      expect(row.getByText("sharing.granteeTypeTeam")).toBeVisible();
      // The head count is the one thing a team row carries that a name does not.
      expect(row.getByText("sharing.teamMemberCount")).toBeVisible();
    });

    it("never marks a team as an outside collaborator, even if the flag says so", () => {
      // Seeded `true` on purpose: a fixture that hard-codes `false` would pass
      // whether or not the component suppresses the badge, so it would pin nothing.
      // "Outside collaborator" means the grantee is not in the owning organization,
      // which a team cannot be — so the badge is wrong here whatever the flag holds.
      renderList([teamGrant({ isOutsideCollaborator: true })]);

      expect(
        within(rowFor("Imaging")).queryByText("sharing.outsideCollaborator"),
      ).not.toBeInTheDocument();
      expect(within(rowFor("Imaging")).getByText("sharing.granteeTypeTeam")).toBeVisible();
    });

    it("still marks a non-team grantee as an outside collaborator", () => {
      // The other half of the control: the badge is suppressed for teams only, not
      // dropped from the row component altogether.
      renderList([
        createResourceGrant({
          granteeId: "user-9",
          isOutsideCollaborator: true,
          grantee: {
            type: "user",
            displayName: "Grace Hopper",
            email: "grace@example.com",
            avatarUrl: null,
            memberCount: null,
          },
        }),
      ]);

      expect(within(rowFor("Grace Hopper")).getByText("sharing.outsideCollaborator")).toBeVisible();
    });

    it("gives a team row the same tier control and revoke as any other grant", async () => {
      const user = userEvent.setup();
      renderList([teamGrant({ role: "admin" })]);

      const row = within(rowFor("Imaging"));
      const tier = row.getByRole("combobox", { name: /roleForLabel/u });
      expect(tier).toBeVisible();
      await user.click(row.getByRole("button", { name: /revokeForLabel/u }));

      expect(screen.getByText("sharing.revokeTitle")).toBeVisible();
    });
  });

  describe("picker source", () => {
    function renderPicker() {
      return render(
        <GranteePicker
          resourceType="experiment"
          resourceId="exp-1"
          role="viewer"
          selection={null}
          onSelectionChange={vi.fn()}
        />,
      );
    }

    it("offers no Teams source when the owning organization has none", async () => {
      const user = userEvent.setup();
      mockSession({ id: "user-1" });
      const spy = server.mount(contract.organizations.listGranteeTeams, { body: [] });

      renderPicker();

      await waitFor(() => {
        expect(spy.called).toBe(true);
      });
      await user.click(screen.getByRole("combobox", { name: "sharing.granteeTypeLabel" }));

      // An empty source reads as a broken picker; most resources belong to an
      // organization with no teams at all.
      expect(
        within(screen.getByRole("listbox")).queryByRole("option", {
          name: "sharing.granteeTypeTeam",
        }),
      ).not.toBeInTheDocument();
    });

    it("offers the owning organization's teams with their head counts", async () => {
      const user = userEvent.setup();
      mockSession({ id: "user-1" });
      server.mount(contract.organizations.listGranteeTeams, {
        body: [
          { id: "team-1", name: "Imaging", organizationId: "org-1", memberCount: 4 },
          { id: "team-2", name: "Fieldwork", organizationId: "org-1", memberCount: 2 },
        ],
      });

      renderPicker();

      await user.click(await screen.findByRole("combobox", { name: "sharing.granteeTypeLabel" }));
      await user.click(
        await within(screen.getByRole("listbox")).findByRole("option", {
          name: "sharing.granteeTypeTeam",
        }),
      );

      // Teams are browsable without a search term, like organizations.
      await user.click(screen.getByRole("textbox", { name: "sharing.granteeSearchLabel" }));

      expect(await screen.findByText("Imaging")).toBeVisible();
      expect(screen.getByText("Fieldwork")).toBeVisible();
      expect(screen.getAllByText("sharing.teamMemberCount")).toHaveLength(2);
    });

    it("filters the returned teams by the typed term, since the endpoint takes none", async () => {
      const user = userEvent.setup();
      mockSession({ id: "user-1" });
      server.mount(contract.organizations.listGranteeTeams, {
        body: [
          { id: "team-1", name: "Imaging", organizationId: "org-1", memberCount: 4 },
          { id: "team-2", name: "Fieldwork", organizationId: "org-1", memberCount: 2 },
        ],
      });

      renderPicker();

      await user.click(await screen.findByRole("combobox", { name: "sharing.granteeTypeLabel" }));
      await user.click(
        await within(screen.getByRole("listbox")).findByRole("option", {
          name: "sharing.granteeTypeTeam",
        }),
      );
      await user.type(screen.getByRole("textbox", { name: "sharing.granteeSearchLabel" }), "field");

      expect(await screen.findByText("Fieldwork")).toBeVisible();
      await waitFor(() => {
        expect(screen.queryByText("Imaging")).not.toBeInTheDocument();
      });
    });

    it("does not re-offer a team that already holds a grant", async () => {
      const user = userEvent.setup();
      mockSession({ id: "user-1" });
      server.mount(contract.organizations.listGranteeTeams, {
        body: [{ id: "team-1", name: "Imaging", organizationId: "org-1", memberCount: 4 }],
      });

      render(
        <GranteePicker
          resourceType="experiment"
          resourceId="exp-1"
          role="viewer"
          selection={null}
          onSelectionChange={vi.fn()}
          existingGranteeIds={["team-1"]}
        />,
      );

      await user.click(await screen.findByRole("combobox", { name: "sharing.granteeTypeLabel" }));
      await user.click(
        await within(screen.getByRole("listbox")).findByRole("option", {
          name: "sharing.granteeTypeTeam",
        }),
      );
      await user.click(screen.getByRole("textbox", { name: "sharing.granteeSearchLabel" }));

      expect(await screen.findByText("sharing.noTeamsFound")).toBeVisible();
    });

    it("reports a chosen team as a team grantee", async () => {
      const user = userEvent.setup();
      mockSession({ id: "user-1" });
      server.mount(contract.organizations.listGranteeTeams, {
        body: [{ id: "team-1", name: "Imaging", organizationId: "org-1", memberCount: 4 }],
      });
      const onSelectionChange = vi.fn();

      render(
        <GranteePicker
          resourceType="experiment"
          resourceId="exp-1"
          role="viewer"
          selection={null}
          onSelectionChange={onSelectionChange}
        />,
      );

      await user.click(await screen.findByRole("combobox", { name: "sharing.granteeTypeLabel" }));
      await user.click(
        await within(screen.getByRole("listbox")).findByRole("option", {
          name: "sharing.granteeTypeTeam",
        }),
      );
      await user.click(screen.getByRole("textbox", { name: "sharing.granteeSearchLabel" }));
      await user.click(await screen.findByRole("button", { name: /Imaging/u }));

      expect(onSelectionChange).toHaveBeenCalledWith({
        kind: "grantee",
        grantee: { type: "team", id: "team-1", displayName: "Imaging", memberCount: 4 },
      });
    });
  });
});
