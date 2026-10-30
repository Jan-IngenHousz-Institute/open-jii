import {
  createOrganizationMember,
  createOrganizationProfile,
  createOrganizationTeam,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, within } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { OrganizationTeamDetail } from "./organization-team-detail";

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

const nameless = {
  userId: "user-nameless",
  firstName: "",
  lastName: "",
  email: null,
  avatarUrl: null,
};
const viewer = {
  userId: "user-me",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@uni.edu",
  avatarUrl: null,
};

function renderTeam() {
  server.mount(contract.organizations.getOrganization, {
    body: createOrganizationProfile({ id: "org-1", role: "owner" }),
  });
  server.mount(contract.organizations.listOrganizationTeams, {
    body: [createOrganizationTeam({ id: "team-1", name: "Imaging", members: [nameless, viewer] })],
  });
  server.mount(contract.organizations.listOrganizationMembers, {
    body: { members: [createOrganizationMember(nameless), createOrganizationMember(viewer)] },
  });
  server.mount(contract.organizations.listOrganizationTeamGrants, { body: [] });
  return render(<OrganizationTeamDetail organizationId="org-1" teamId="team-1" />);
}

describe("<OrganizationTeamDetail />", () => {
  afterEach(() => mockSession(null));

  it("names a member with no name by the fallback, never by their id, and marks the viewer", async () => {
    mockSession({ id: "user-me" });
    renderTeam();

    const list = await screen.findByRole("list", { name: "organizations.members.title" });
    expect(within(list).getByText("common.unnamedAccount")).toBeInTheDocument();
    expect(within(list).getByText("sharing.you")).toBeInTheDocument();
    expect(screen.queryByText(/user-nameless/u)).not.toBeInTheDocument();
  });
});
