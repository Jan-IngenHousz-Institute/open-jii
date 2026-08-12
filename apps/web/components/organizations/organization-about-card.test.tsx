import { createOrganizationProfile } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
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
});
