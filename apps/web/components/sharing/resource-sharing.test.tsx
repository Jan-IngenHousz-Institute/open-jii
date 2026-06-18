import { describe, expect, it } from "vitest";
import { server } from "~/test/msw/server";
import { render, screen, userEvent, waitFor } from "~/test/test-utils";

import { contract } from "@repo/api/contract";

import { ResourceSharing } from "./resource-sharing";

const RT = "experiment" as const;
const RID = "11111111-1111-1111-1111-111111111111";
const GRACE = "22222222-2222-2222-2222-222222222222";

function mountAccess(canShare: boolean) {
  return server.mount(contract.sharing.getResourceAccess, {
    body: { canRead: true, canUpdate: canShare, canDelete: canShare, canShare },
  });
}

const grantee = {
  type: "user" as const,
  displayName: null,
  email: null,
  avatarUrl: null,
};

function mountGrants(
  body: {
    id: string;
    resourceType: typeof RT;
    resourceId: string;
    granteeType: "user";
    granteeId: string;
    role: string;
    createdAt: string;
    createdBy: string | null;
    grantee: typeof grantee;
  }[],
) {
  return server.mount(contract.sharing.listResourceGrants, { body });
}

describe("ResourceSharing", () => {
  it("shows the empty state and a search box when the user can share", async () => {
    mountAccess(true);
    mountGrants([]);
    server.mount(contract.users.searchUsers, { body: [] });

    render(<ResourceSharing resourceType={RT} resourceId={RID} />);

    expect(await screen.findByText("Not shared with anyone yet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Search people to share with")).toBeInTheDocument();
  });

  it("hides sharing controls when the user cannot share", async () => {
    mountAccess(false);
    mountGrants([
      {
        id: "g1",
        resourceType: RT,
        resourceId: RID,
        granteeType: "user",
        granteeId: GRACE,
        role: "member",
        createdAt: "2024-01-01T00:00:00.000Z",
        createdBy: null,
        grantee,
      },
    ]);

    render(<ResourceSharing resourceType={RT} resourceId={RID} />);

    expect(await screen.findByText(GRACE)).toBeInTheDocument();
    expect(screen.queryByLabelText("Search people to share with")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove access/ })).not.toBeInTheDocument();
  });

  it("shares with a searched user", async () => {
    mountAccess(true);
    mountGrants([]);
    server.mount(contract.users.searchUsers, {
      body: [
        {
          userId: GRACE,
          firstName: "Grace",
          lastName: "Hopper",
          bio: null,
          activated: true,
          email: "grace@example.com",
          avatarUrl: null,
        },
      ],
    });
    const spy = server.mount(contract.sharing.createResourceGrant, {
      body: {
        id: "33333333-3333-3333-3333-333333333333",
        resourceType: RT,
        resourceId: RID,
        granteeType: "user",
        granteeId: GRACE,
        role: "member",
        createdAt: "2024-01-01T00:00:00.000Z",
        createdBy: null,
      },
    });

    render(<ResourceSharing resourceType={RT} resourceId={RID} />);

    await userEvent.type(await screen.findByLabelText("Search people to share with"), "grace");
    await userEvent.click(await screen.findByRole("button", { name: "Share" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({ granteeType: "user", granteeId: GRACE, role: "member" });
    expect(spy.params).toMatchObject({ resourceType: RT, resourceId: RID });
  });

  it("revokes an existing grant", async () => {
    mountAccess(true);
    mountGrants([
      {
        id: "grant-1",
        resourceType: RT,
        resourceId: RID,
        granteeType: "user",
        granteeId: GRACE,
        role: "member",
        createdAt: "2024-01-01T00:00:00.000Z",
        createdBy: null,
        grantee,
      },
    ]);
    const spy = server.mount(contract.sharing.revokeResourceGrant, { body: { success: true } });

    render(<ResourceSharing resourceType={RT} resourceId={RID} />);
    await userEvent.click(
      await screen.findByRole("button", { name: `Remove access for ${GRACE}` }),
    );

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toMatchObject({ resourceType: RT, resourceId: RID, grantId: "grant-1" });
  });

  it("surfaces an error when sharing fails", async () => {
    mountAccess(true);
    mountGrants([]);
    server.mount(contract.users.searchUsers, {
      body: [
        {
          userId: GRACE,
          firstName: "Grace",
          lastName: "Hopper",
          bio: null,
          activated: true,
          email: "grace@example.com",
          avatarUrl: null,
        },
      ],
    });
    const spy = server.mount(contract.sharing.createResourceGrant, {
      status: 403,
      body: { message: "You cannot share this resource" },
    });

    render(<ResourceSharing resourceType={RT} resourceId={RID} />);
    await userEvent.type(await screen.findByLabelText("Search people to share with"), "grace");
    await userEvent.click(await screen.findByRole("button", { name: "Share" }));

    await waitFor(() => expect(spy.called).toBe(true));
  });
});
