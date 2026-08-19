import { createOrganizationProfile } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { OrganizationHeader } from "./organization-header";

describe("<OrganizationHeader />", () => {
  it("links a stored http(s) website", () => {
    render(
      <OrganizationHeader
        organization={createOrganizationProfile({ website: "https://openjii.org/" })}
      />,
    );

    expect(screen.getByRole("link", { name: /organizations.fields.website/u })).toHaveAttribute(
      "href",
      "https://openjii.org/",
    );
  });

  it("renders whatever website is stored, as any other link would", () => {
    // No defensive re-validation here any more: the field uses the platform's standard
    // URL rule and nothing else, so a value that got past it is rendered as-is. The
    // residual risk is accepted — browsers block top-level `data:` navigation and React
    // blocks `javascript:` hrefs.
    render(
      <OrganizationHeader
        organization={createOrganizationProfile({ website: "https://openjii.org/about" })}
      />,
    );

    expect(screen.getByRole("link", { name: /organizations.fields.website/u })).toHaveAttribute(
      "href",
      "https://openjii.org/about",
    );
  });

  it("renders no website link when the organization has none", () => {
    render(<OrganizationHeader organization={createOrganizationProfile({ website: null })} />);

    expect(screen.queryByRole("link", { name: /organizations.fields.website/u })).toBeNull();
  });
});
