import {
  createOrganizationMember,
  createOrganizationProfile,
  createOrganizationTeam,
} from "@/test/factories";
import { render, screen, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { OrganizationAboutCard } from "./organization-about-card";

describe("<OrganizationAboutCard />", () => {
  it("renders a rich-text description as formatting, not as markup", () => {
    render(
      <OrganizationAboutCard
        organization={createOrganizationProfile({
          description: "<p>A field group studying <strong>canopy</strong> photosynthesis.</p>",
        })}
      />,
    );

    // A roomy paragraph, so real formatting belongs here — but never literal tags.
    expect(screen.getByText("canopy").tagName).toBe("STRONG");
    expect(screen.queryByText(/<p>|<strong>/u)).toBeNull();
  });

  it("uses the translated empty state rather than the renderer's own", () => {
    render(
      <OrganizationAboutCard organization={createOrganizationProfile({ description: null })} />,
    );

    // Handed empty content, RichTextRenderer substitutes a hardcoded English string,
    // which would appear untranslated on de-DE and nl-NL. The guard keeps it away.
    expect(screen.getByText("organizations.about.noDescription")).toBeVisible();
    expect(screen.queryByText("No description provided")).toBeNull();
  });

  it("omits a row for every field the organization has not set", () => {
    render(
      <OrganizationAboutCard
        organization={createOrganizationProfile({ type: null, location: null, website: null })}
      />,
    );

    expect(screen.queryByText("organizations.fields.type")).toBeNull();
    expect(screen.queryByText("organizations.fields.location")).toBeNull();
    expect(screen.queryByText("organizations.fields.website")).toBeNull();
    // The creation date is always known, so that row always stands.
    expect(screen.getByText("organizations.about.onOpenJii")).toBeVisible();
  });

  it("links the website by host, since a full URL wraps out of the column", () => {
    render(
      <OrganizationAboutCard
        organization={createOrganizationProfile({
          website: "https://canopylab.example.org/about/team",
        })}
      />,
    );

    const link = screen.getByRole("link", { name: /canopylab\.example\.org/u });
    expect(link).toHaveAttribute("href", "https://canopylab.example.org/about/team");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("stacks each label over its value rather than beside it", () => {
    render(<OrganizationAboutCard organization={createOrganizationProfile({ type: null })} />);

    // The idiom every resource detail overview uses: the label is its own line, the
    // value below it — so neither is squeezed into a fixed-width column.
    const label = screen.getByText("organizations.about.onOpenJii");
    expect(label.tagName).toBe("DT");
    expect(label.className).not.toMatch(/w-\d/u);
  });

  describe("the people entries", () => {
    it("shows a face per member, capped, and links through to the members tab", () => {
      const members = Array.from({ length: 7 }, (_, index) =>
        createOrganizationMember({ userId: `u-${index}`, firstName: "Ada", lastName: "Lovelace" }),
      );

      render(
        <OrganizationAboutCard
          organization={createOrganizationProfile({ id: "org-9", memberCount: 7 })}
          members={members}
        />,
      );

      const trail = screen.getByRole("link", { name: /organizations\.memberCount/u });
      expect(trail).toHaveAttribute("href", "/en-US/platform/organizations/org-9/members");
      // Five faces plus the remainder bubble, not seven faces in a 336px column.
      expect(within(trail).getByText("+2")).toBeVisible();
    });

    it("gives a team its initials, since a team has no picture of its own", () => {
      render(
        <OrganizationAboutCard
          organization={createOrganizationProfile({ id: "org-9" })}
          teams={[createOrganizationTeam({ id: "t-1", name: "Field crew" })]}
        />,
      );

      const trail = screen.getByRole("link", { name: /organizations\.about\.teamCount/u });
      expect(trail).toHaveAttribute("href", "/en-US/platform/organizations/org-9/teams");
      expect(within(trail).getByText("FC")).toBeVisible();
    });

    it("still states the counts before the rosters have arrived", () => {
      render(
        <OrganizationAboutCard
          organization={createOrganizationProfile({ memberCount: 4 })}
          isMembersPending
          isTeamsPending
        />,
      );

      // The profile carries the member count, so the caption does not wait on the
      // roster read — only the faces do.
      expect(screen.getByRole("link", { name: /organizations\.memberCount/u })).toBeVisible();
      expect(screen.getByRole("link", { name: /organizations\.about\.teamCount/u })).toBeVisible();
    });

    it("shows neither to a visitor, matching the endpoints behind them", () => {
      render(
        <OrganizationAboutCard
          organization={createOrganizationProfile({ role: null, membershipStatus: "none" })}
        />,
      );

      expect(screen.queryByText("organizations.tabs.members")).toBeNull();
      expect(screen.queryByText("organizations.tabs.teams")).toBeNull();
    });
  });
});
