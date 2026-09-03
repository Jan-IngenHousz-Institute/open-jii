import { createOrganizationTeamGrant } from "@/test/factories";
import { render, screen, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { OrganizationTeamGrants } from "./organization-team-grants";

describe("<OrganizationTeamGrants />", () => {
  it("does not claim the team reaches nothing while the grants are still loading", () => {
    render(<OrganizationTeamGrants grants={[]} isPending />);

    // "Nothing has been shared with this team yet" is a finding, and this page is
    // where somebody checks what deleting the team would withdraw.
    expect(screen.queryByText("organizations.teams.grantsEmpty")).not.toBeInTheDocument();
    expect(screen.getByText("organizations.teams.grantsTitle")).toBeInTheDocument();
  });

  it("says so when the grants could not be read, rather than showing an empty list", () => {
    render(<OrganizationTeamGrants grants={[]} isError />);

    expect(screen.getByText("organizations.teams.grantsLoadFailed")).toBeInTheDocument();
    expect(screen.queryByText("organizations.teams.grantsEmpty")).not.toBeInTheDocument();
  });

  it("names its list for assistive technology", () => {
    render(
      <OrganizationTeamGrants
        grants={[createOrganizationTeamGrant({ resourceName: "Canopy series" })]}
      />,
    );

    expect(
      screen.getByRole("list", { name: "organizations.teams.grantsTitle" }),
    ).toBeInTheDocument();
  });

  it("links every grantable type, devices included", () => {
    render(
      <OrganizationTeamGrants
        grants={[
          createOrganizationTeamGrant({
            resourceType: "experiment",
            resourceId: "exp-1",
            resourceName: "Canopy series",
          }),
          createOrganizationTeamGrant({
            resourceType: "protocol",
            resourceId: "pro-1",
            resourceName: "Dark adaptation",
          }),
          createOrganizationTeamGrant({
            resourceType: "macro",
            resourceId: "mac-1",
            resourceName: "Batch fit",
          }),
          createOrganizationTeamGrant({
            resourceType: "workbook",
            resourceId: "wor-1",
            resourceName: "Synthesis",
          }),
          createOrganizationTeamGrant({
            resourceType: "device",
            resourceId: "dev-1",
            resourceName: "Canopy MultispeQ 01",
          }),
        ]}
      />,
    );

    const href = (name: string) => screen.getByRole("link", { name }).getAttribute("href");

    expect(href("Canopy series")).toBe("/en-US/platform/experiments/exp-1");
    expect(href("Dark adaptation")).toBe("/en-US/platform/protocols/pro-1");
    expect(href("Batch fit")).toBe("/en-US/platform/macros/mac-1");
    expect(href("Synthesis")).toBe("/en-US/platform/workbooks/wor-1");
    // A device takes grants like the rest and has a detail page to link to; what it
    // cannot do is be published.
    expect(href("Canopy MultispeQ 01")).toBe("/en-US/platform/devices/dev-1");
  });

  it("marks each row with its type's own icon, and hides it from assistive tech", () => {
    const { container } = render(
      <OrganizationTeamGrants
        grants={[
          createOrganizationTeamGrant({ resourceType: "experiment", resourceName: "Canopy" }),
          createOrganizationTeamGrant({ resourceType: "protocol", resourceName: "Dark" }),
          createOrganizationTeamGrant({ resourceType: "macro", resourceName: "Fit" }),
          createOrganizationTeamGrant({ resourceType: "workbook", resourceName: "Synthesis" }),
          createOrganizationTeamGrant({ resourceType: "device", resourceName: "Ambyte" }),
          createOrganizationTeamGrant({ resourceType: "device_group", resourceName: "Fleet" }),
        ]}
      />,
    );

    // The marks the sidebar and the command palette already use for these types, so a
    // row here is recognisable from anywhere else the type shows up. Every grantable
    // type is here on purpose: an icon map missing one renders `undefined` as the
    // component, which throws at render rather than falling back to something neutral.
    const iconFor = (name: string) =>
      within(container)
        .getByRole("link", { name })
        .closest("[role='listitem']")
        ?.querySelector("svg.lucide");

    expect(iconFor("Canopy")).toHaveClass("lucide-leaf");
    expect(iconFor("Dark")).toHaveClass("lucide-file-sliders");
    expect(iconFor("Fit")).toHaveClass("lucide-code");
    expect(iconFor("Synthesis")).toHaveClass("lucide-book-open");
    expect(iconFor("Ambyte")).toHaveClass("lucide-radio-receiver");
    expect(iconFor("Fleet")).toHaveClass("lucide-boxes");

    // The type is already stated in words on the right of the row; an accessible name
    // here would have it announced twice.
    for (const icon of container.querySelectorAll("svg.lucide")) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("still links a device whose name fell back to its thing name", () => {
    // The fallback is a display concern; the id is what routes.
    render(
      <OrganizationTeamGrants
        grants={[
          createOrganizationTeamGrant({
            resourceType: "device",
            resourceId: "dev-2",
            resourceName: "orgseed-canopy-ambyte-01",
          }),
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "orgseed-canopy-ambyte-01" })).toHaveAttribute(
      "href",
      "/en-US/platform/devices/dev-2",
    );
  });

  it("names the access tier in the sharing surface's own words", () => {
    render(
      <OrganizationTeamGrants
        grants={[
          createOrganizationTeamGrant({ resourceName: "Editable", role: "admin" }),
          createOrganizationTeamGrant({ resourceName: "Readable", role: "viewer" }),
          // Legacy vocabulary: nothing mints `owner` any more, but a stored row renders.
          createOrganizationTeamGrant({ resourceName: "Legacy", role: "owner" }),
        ]}
      />,
    );

    expect(screen.getAllByText("sharing.roleCanEdit")).toHaveLength(2);
    expect(screen.getByText("sharing.roleCanView")).toBeVisible();
  });

  it("says so when nothing has been shared with the team", () => {
    render(<OrganizationTeamGrants grants={[]} />);

    expect(screen.getByText("organizations.teams.grantsEmpty")).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
