import { describe, expect, it } from "vitest";
import { server } from "~/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "~/test/test-utils";

import { contract } from "@repo/api/contract";
import type { ResourceGrantWithGranteeDto } from "@repo/api/schemas/sharing.schema";

import { ResourceCollaborators } from "./resource-collaborators";

const RT = "macro" as const;
const RID = "11111111-1111-1111-1111-111111111111";
const ORG_ID = "00000000-0000-4000-8000-000000000abc";
const GRANT_ID = "99999999-9999-9999-9999-999999999999";

function mountAccess(canShare: boolean, isCollaborator = true) {
  return server.mount(contract.sharing.getResourceAccess, {
    body: {
      canRead: true,
      canUpdate: canShare,
      canDelete: canShare,
      canShare,
      isCollaborator,
      organizationId: ORG_ID,
      visibility: "private",
    },
  });
}

const userGrant: ResourceGrantWithGranteeDto = {
  id: GRANT_ID,
  resourceType: RT,
  resourceId: RID,
  granteeType: "user",
  granteeId: "22222222-2222-2222-2222-222222222222",
  role: "member",
  createdAt: "2024-01-01T00:00:00.000Z",
  createdBy: null,
  grantee: {
    type: "user",
    displayName: "Grace Hopper",
    email: "grace@example.com",
    avatarUrl: null,
    isOrgMember: true,
  },
};

const outsideGrant: ResourceGrantWithGranteeDto = {
  ...userGrant,
  id: "77777777-7777-7777-7777-777777777777",
  granteeId: "33333333-3333-3333-3333-333333333333",
  grantee: {
    type: "user",
    displayName: "Ada Outsider",
    email: "ada@example.com",
    avatarUrl: null,
    isOrgMember: false,
  },
};

function mountGrants(body: ResourceGrantWithGranteeDto[]) {
  return server.mount(contract.sharing.listResourceGrants, { body });
}

describe("ResourceCollaborators", () => {
  it("renders the GitHub-style header, visibility card, and a collaborator row", async () => {
    mountAccess(true);
    mountGrants([userGrant]);

    render(<ResourceCollaborators resourceType={RT} resourceId={RID} />);

    expect(
      await screen.findByRole("heading", { name: "Collaborators and teams" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(await screen.findByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Role for Grace Hopper" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add people" })).toBeInTheDocument();
  });

  it("shows a private notice and skips the grants list for non-collaborators", async () => {
    mountAccess(false, false);
    const grantsSpy = mountGrants([userGrant]);

    render(<ResourceCollaborators resourceType={RT} resourceId={RID} />);

    expect(await screen.findByText("Collaborators are private")).toBeInTheDocument();
    expect(screen.queryByText("Grace Hopper")).not.toBeInTheDocument();
    // The grants endpoint is never hit for a public-read viewer.
    expect(grantsSpy.called).toBe(false);
  });

  it("labels a non-org-member grant as an Outside Collaborator", async () => {
    mountAccess(true);
    mountGrants([outsideGrant]);

    render(<ResourceCollaborators resourceType={RT} resourceId={RID} />);

    expect(await screen.findByText("Ada Outsider")).toBeInTheDocument();
    expect(screen.getByText("Outside Collaborator")).toBeInTheDocument();
  });

  it("hides management controls when the user cannot share", async () => {
    mountAccess(false);
    mountGrants([userGrant]);

    render(<ResourceCollaborators resourceType={RT} resourceId={RID} />);

    expect(await screen.findByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add people" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Role for Grace Hopper" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove access for Grace Hopper" }),
    ).not.toBeInTheDocument();
  });

  it("changes a grant's role (PATCH)", async () => {
    mountAccess(true);
    mountGrants([userGrant]);
    const spy = server.mount(contract.sharing.updateResourceGrant, {
      body: { ...userGrant, role: "admin", grantee: undefined } as never,
    });

    render(<ResourceCollaborators resourceType={RT} resourceId={RID} />);
    await userEvent.click(await screen.findByRole("combobox", { name: "Role for Grace Hopper" }));
    await userEvent.click(screen.getByRole("option", { name: "admin" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toMatchObject({ resourceType: RT, resourceId: RID, grantId: GRANT_ID });
    expect(spy.body).toMatchObject({ role: "admin" });
  });

  it("removes a grant via the trash button (DELETE)", async () => {
    mountAccess(true);
    mountGrants([userGrant]);
    const spy = server.mount(contract.sharing.revokeResourceGrant, { body: { success: true } });

    render(<ResourceCollaborators resourceType={RT} resourceId={RID} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Remove access for Grace Hopper" }),
    );

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toMatchObject({ resourceType: RT, resourceId: RID, grantId: GRANT_ID });
  });

  it("adds a person via the Add people dialog (POST)", async () => {
    mountAccess(true);
    mountGrants([]);
    server.mount(contract.users.searchUsers, {
      body: [
        {
          userId: "44444444-4444-4444-4444-444444444444",
          firstName: "Ada",
          lastName: "Lovelace",
          bio: null,
          activated: true,
          email: "ada@example.com",
          avatarUrl: null,
        },
      ],
    });
    const spy = server.mount(contract.sharing.createResourceGrant, {
      body: { ...userGrant, grantee: undefined } as never,
    });

    render(<ResourceCollaborators resourceType={RT} resourceId={RID} />);
    await userEvent.click(await screen.findByRole("button", { name: "Add people" }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByPlaceholderText(/Search people by name or email/),
      "ada",
    );
    await userEvent.click(await screen.findByText("Ada Lovelace"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Share" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({
      granteeType: "user",
      granteeId: "44444444-4444-4444-4444-444444444444",
    });
  });

  it("invites a person by email who has no account yet (POST invitation)", async () => {
    mountAccess(true);
    mountGrants([]);
    server.mount(contract.users.searchUsers, { body: [] });
    const spy = server.mount(contract.sharing.inviteResourceUser, {
      status: 201,
      body: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        email: "newbie@example.com",
        role: "member",
        status: "pending",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    });

    render(<ResourceCollaborators resourceType={RT} resourceId={RID} />);
    await userEvent.click(await screen.findByRole("button", { name: "Add people" }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByPlaceholderText(/Search people by name or email/),
      "newbie@example.com",
    );
    await userEvent.click(
      await screen.findByText(/Invite .*newbie@example.com|newbie@example.com/),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Share" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({ email: "newbie@example.com" });
  });

  it("shows org members + teams on the Organization access tab", async () => {
    mountAccess(true);
    mountGrants([]);
    server.mount(contract.organizations.getOrganizationAccess, {
      body: {
        organization: {
          id: ORG_ID,
          name: "Photosynthesis Lab",
          slug: "photosynthesis-lab",
          logo: null,
          type: "research_institute",
          description: null,
          website: null,
          location: null,
          visibility: "public",
          memberCount: 2,
          membershipStatus: "member",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        members: [
          {
            id: "55555555-5555-5555-5555-555555555555",
            displayName: "Bob Rivera",
            email: "bob@example.com",
            avatarUrl: null,
            role: "admin",
          },
        ],
        teams: [{ id: "66666666-6666-6666-6666-666666666666", name: "Imaging", memberCount: 3 }],
      },
    });

    render(<ResourceCollaborators resourceType={RT} resourceId={RID} />);
    await userEvent.click(await screen.findByRole("tab", { name: /Organization access/ }));

    expect(await screen.findByText("Imaging")).toBeInTheDocument();
    expect(screen.getByText("Bob Rivera")).toBeInTheDocument();
  });
});
