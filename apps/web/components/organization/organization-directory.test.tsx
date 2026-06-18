import { describe, expect, it } from "vitest";
import { server } from "~/test/msw/server";
import { render, screen, userEvent, waitFor } from "~/test/test-utils";

import { contract } from "@repo/api/contract";
import type { OrganizationSummary } from "@repo/api/schemas/organization.schema";

import { OrganizationDirectory } from "./organization-directory";

const org = (over: Partial<OrganizationSummary>): OrganizationSummary => ({
  id: "11111111-1111-1111-1111-111111111111",
  name: "Community Lab",
  slug: "community-lab",
  logo: null,
  type: "research_institute",
  description: "Open lab for everyone",
  website: null,
  location: null,
  visibility: "public",
  memberCount: 3,
  membershipStatus: "none",
  createdAt: "2024-01-01T00:00:00.000Z",
  ...over,
});

describe("OrganizationDirectory", () => {
  it("renders public organizations with member counts", async () => {
    server.mount(contract.organizations.listPublicOrganizations, { body: [org({})] });

    render(<OrganizationDirectory />);

    expect(await screen.findByText("Community Lab")).toBeInTheDocument();
    expect(screen.getByText("Open lab for everyone")).toBeInTheDocument();
    expect(screen.getByText(/3 members/)).toBeInTheDocument();
  });

  it("requests to join a non-member org", async () => {
    server.mount(contract.organizations.listPublicOrganizations, { body: [org({})] });
    const spy = server.mount(contract.organizations.requestToJoin, {
      status: 201,
      body: {
        id: "req-1",
        organizationId: "11111111-1111-1111-1111-111111111111",
        user: { id: "u1", firstName: "A", lastName: "B", email: null, avatarUrl: null },
        message: null,
        status: "pending",
        decidedBy: null,
        decidedAt: null,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    });

    render(<OrganizationDirectory />);
    await userEvent.click(await screen.findByRole("button", { name: "Request to join" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toMatchObject({ id: "11111111-1111-1111-1111-111111111111" });
  });

  it("shows a Requested state for a pending org and an Open link for a member", async () => {
    server.mount(contract.organizations.listPublicOrganizations, {
      body: [
        org({
          id: "22222222-2222-2222-2222-222222222222",
          name: "Pending Org",
          membershipStatus: "pending",
        }),
        org({
          id: "33333333-3333-3333-3333-333333333333",
          name: "My Org",
          membershipStatus: "member",
        }),
      ],
    });

    render(<OrganizationDirectory />);

    expect(await screen.findByText("Pending Org")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Requested/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toBeInTheDocument();
  });
});
