import { createOrganizationTeamGrant } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { OrganizationTeamGrants } from "./organization-team-grants";

describe("<OrganizationTeamGrants />", () => {
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
    // A device has no sharing surface but does have a detail page.
    expect(href("Canopy MultispeQ 01")).toBe("/en-US/platform/devices/dev-1");
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
