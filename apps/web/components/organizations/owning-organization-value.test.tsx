import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { OwningOrganizationValue } from "./owning-organization-value";

/**
 * The owning organization answers a different question from created-by — which
 * organization's members can reach this resource — so the two sit side by side on
 * every detail surface. A personal workspace has no page to link to: it is excluded
 * from the whole organization surface, so it reads as "Personal" and stays inert.
 */
describe("<OwningOrganizationValue />", () => {
  it("links a real organization to its page", () => {
    render(<OwningOrganizationValue organizationId="org-1" organizationName="Greenhouse Lab" />);

    expect(screen.getByRole("link", { name: "Greenhouse Lab" })).toHaveAttribute(
      "href",
      "/en-US/platform/organizations/org-1",
    );
  });

  it("reads Personal, unlinked, for a personal workspace", () => {
    // The server sends a null name for one rather than its generated title, so no
    // client has to know the slug rule that identifies it.
    render(<OwningOrganizationValue organizationId="org-personal" organizationName={null} />);

    expect(screen.getByText("organizations.picker.personal")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("reads Personal for a row that carries no organization at all", () => {
    render(<OwningOrganizationValue organizationId={null} organizationName={null} />);

    expect(screen.getByText("organizations.picker.personal")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not link a name it has without an id to point at", () => {
    render(<OwningOrganizationValue organizationId={null} organizationName="Greenhouse Lab" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
