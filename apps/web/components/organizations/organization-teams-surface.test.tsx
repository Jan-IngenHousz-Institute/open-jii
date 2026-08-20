import { createOrganizationProfile, createOrganizationTeam } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, within } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { OrganizationTeamsSurface } from "./organization-teams-surface";

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

const imaging = createOrganizationTeam({ id: "team-1", name: "Imaging" });

/** The teams read answers; only the grants read varies across these cases. */
function mountTeams() {
  server.mount(contract.organizations.getOrganization, {
    body: createOrganizationProfile({ id: "org-1", role: "owner" }),
  });
  return server.mount(contract.organizations.listOrganizationTeams, { body: [imaging] });
}

const teamCard = () => screen.getByRole("link", { name: /Imaging/u });

describe("<OrganizationTeamsSurface />", () => {
  afterEach(() => {
    mockSession(null);
  });

  it("does not report zero reach while the grants are still loading", async () => {
    mockSession({ id: "user-1" });
    mountTeams();
    server.mount(contract.organizations.listOrganizationTeamGrants, { delay: "infinite" });

    render(<OrganizationTeamsSurface organizationId="org-1" />);

    // A count of zero is a claim about what deleting this team would withdraw, and
    // an unanswered read cannot make it.
    await waitFor(() => expect(teamCard()).toBeInTheDocument());
    expect(
      within(teamCard()).queryByText("organizations.teams.grantCount"),
    ).not.toBeInTheDocument();
  });

  it("says the reach is unknown when the grants could not be read", async () => {
    mockSession({ id: "user-1" });
    mountTeams();
    server.mount(contract.organizations.listOrganizationTeamGrants, { status: 500 });

    render(<OrganizationTeamsSurface organizationId="org-1" />);

    await waitFor(() =>
      expect(
        within(teamCard()).getByText("organizations.teams.grantCountUnavailable"),
      ).toBeInTheDocument(),
    );
    expect(
      within(teamCard()).queryByText("organizations.teams.grantCount"),
    ).not.toBeInTheDocument();
  });

  it("counts the grants once they answer", async () => {
    mockSession({ id: "user-1" });
    mountTeams();
    server.mount(contract.organizations.listOrganizationTeamGrants, {
      body: [
        {
          id: "g-1",
          teamId: "team-1",
          resourceType: "experiment",
          resourceId: "e-1",
          resourceName: "A",
          role: "viewer",
        },
        {
          id: "g-2",
          teamId: "team-1",
          resourceType: "macro",
          resourceId: "m-1",
          resourceName: "B",
          role: "admin",
        },
      ],
    });

    render(<OrganizationTeamsSurface organizationId="org-1" />);

    await waitFor(() =>
      expect(within(teamCard()).getByText("organizations.teams.grantCount")).toBeInTheDocument(),
    );
    expect(
      within(teamCard()).queryByText("organizations.teams.grantCountUnavailable"),
    ).not.toBeInTheDocument();
  });
});
