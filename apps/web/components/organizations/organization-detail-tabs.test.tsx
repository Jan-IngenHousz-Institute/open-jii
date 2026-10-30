import { PrincipalProvider } from "@/components/auth/principal-context";
import { createOrganizationProfile } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationDetailTabs } from "./organization-detail-tabs";

vi.mock("./organization-header", () => ({
  OrganizationHeader: () => <h1>Demo organization</h1>,
}));

describe("<OrganizationDetailTabs />", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/organizations/org-1");
  });

  it.each([
    [false, true],
    [true, false],
  ])("as guest=%s offers a member the members and teams tabs: %s", (isGuest, offered) => {
    render(
      <PrincipalProvider userId="viewer" isGuest={isGuest}>
        <OrganizationDetailTabs organization={createOrganizationProfile({ role: "member" })}>
          <p>Overview</p>
        </OrganizationDetailTabs>
      </PrincipalProvider>,
    );

    expect(screen.getByText("Overview")).toBeInTheDocument();
    for (const tab of ["organizations.tabs.members", "organizations.tabs.teams"]) {
      expect(screen.queryByText(tab) !== null).toBe(offered);
    }
  });
});
