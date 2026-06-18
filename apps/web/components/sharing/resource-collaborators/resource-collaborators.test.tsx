import { describe, expect, it } from "vitest";
import { server } from "~/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "~/test/test-utils";

import { contract } from "@repo/api/contract";
import type { ResourceGrantWithGranteeDto } from "@repo/api/schemas/sharing.schema";

import { ResourceCollaborators } from "./resource-collaborators";

const RT = "macro" as const;
const RID = "11111111-1111-1111-1111-111111111111";
const GRANT_ID = "99999999-9999-9999-9999-999999999999";

function mountAccess(canShare: boolean) {
  return server.mount(contract.sharing.getResourceAccess, {
    body: { canRead: true, canUpdate: canShare, canDelete: canShare, canShare },
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
  },
};

const orgGrant: ResourceGrantWithGranteeDto = {
  ...userGrant,
  id: "88888888-8888-8888-8888-888888888888",
  granteeType: "organization",
  granteeId: "33333333-3333-3333-3333-333333333333",
  role: "admin",
  grantee: {
    type: "organization",
    displayName: "Field Trials Group",
    email: null,
    avatarUrl: null,
  },
};

function mountGrants(body: ResourceGrantWithGranteeDto[]) {
  return server.mount(contract.sharing.listResourceGrants, { body });
}

describe("ResourceCollaborators", () => {
  it("shows the empty state and a Share button when the user can share", async () => {
    mountAccess(true);
    mountGrants([]);

    render(<ResourceCollaborators resourceType={RT} resourceId={RID} />);

    expect(await screen.findByText("Not shared with anyone yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
  });

  it("lists a user grant with name, email, and a role control", async () => {
    mountAccess(true);
    mountGrants([userGrant]);

    render(<ResourceCollaborators resourceType={RT} resourceId={RID} />);

    expect(await screen.findByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByText("grace@example.com")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Role for Grace Hopper" })).toBeInTheDocument();
  });

  it("renders an organization grant with the org name and Organization subtitle", async () => {
    mountAccess(true);
    mountGrants([orgGrant]);

    render(<ResourceCollaborators resourceType={RT} resourceId={RID} />);

    expect(await screen.findByText("Field Trials Group")).toBeInTheDocument();
    expect(screen.getByText("Organization")).toBeInTheDocument();
  });

  it("hides controls when the user cannot share (role shown read-only)", async () => {
    mountAccess(false);
    mountGrants([userGrant]);

    render(<ResourceCollaborators resourceType={RT} resourceId={RID} />);

    expect(await screen.findByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("member")).toBeInTheDocument();
  });

  it("changes a grant's role via the role control (PATCH)", async () => {
    mountAccess(true);
    mountGrants([userGrant]);
    const spy = server.mount(contract.sharing.updateResourceGrant, {
      body: { ...userGrant, role: "admin", grantee: undefined } as never,
    });

    render(<ResourceCollaborators resourceType={RT} resourceId={RID} />);
    await userEvent.click(await screen.findByRole("combobox", { name: "Role for Grace Hopper" }));
    await userEvent.click(screen.getByRole("option", { name: "Admin" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toMatchObject({ resourceType: RT, resourceId: RID, grantId: GRANT_ID });
    expect(spy.body).toMatchObject({ role: "admin" });
  });

  it("removes a grant via the role control (DELETE)", async () => {
    mountAccess(true);
    mountGrants([userGrant]);
    const spy = server.mount(contract.sharing.revokeResourceGrant, { body: { success: true } });

    render(<ResourceCollaborators resourceType={RT} resourceId={RID} />);
    await userEvent.click(await screen.findByRole("combobox", { name: "Role for Grace Hopper" }));
    await userEvent.click(screen.getByRole("option", { name: "Remove" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toMatchObject({ resourceType: RT, resourceId: RID, grantId: GRANT_ID });
  });

  it("shares with a searched person via the Share dialog (POST)", async () => {
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
    await userEvent.click(await screen.findByRole("button", { name: "Share" }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Search people to share with"), "ada");
    await userEvent.click(await within(dialog).findByText("Ada Lovelace"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Share" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toMatchObject({ resourceType: RT, resourceId: RID });
    expect(spy.body).toMatchObject({
      granteeType: "user",
      granteeId: "44444444-4444-4444-4444-444444444444",
      role: "member",
    });
  });
});
