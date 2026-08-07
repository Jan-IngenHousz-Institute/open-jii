import { render, screen } from "@/test/test-utils";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { ResourceDetailTabs } from "./resource-detail-tabs";

function renderTabs(overrides: Partial<React.ComponentProps<typeof ResourceDetailTabs>> = {}) {
  return render(
    <ResourceDetailTabs resourceType="macro" resourceId="macro-1" canShare {...overrides}>
      <p>The macro overview</p>
    </ResourceDetailTabs>,
  );
}

describe("<ResourceDetailTabs />", () => {
  it("renders the content without a tab strip for a viewer who cannot share or leave", () => {
    renderTabs({ canShare: false });

    expect(screen.getByText("The macro overview")).toBeInTheDocument();
    // A lone "Overview" tab is not a tab strip worth showing.
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("gives a non-share grantee the strip too — the leave card lives behind it", () => {
    renderTabs({ canShare: false, canLeave: true });

    expect(screen.getByRole("tab", { name: "sharing.collaboratorsTab" })).toBeInTheDocument();
  });

  it("links both tabs at the resource's own routes", () => {
    renderTabs();

    expect(screen.getByRole("tab", { name: "common.overview" })).toHaveAttribute(
      "href",
      "/en-US/platform/macros/macro-1",
    );
    expect(screen.getByRole("tab", { name: "sharing.collaboratorsTab" })).toHaveAttribute(
      "href",
      "/en-US/platform/macros/macro-1/collaborators",
    );
  });

  it("marks Overview active on the detail route", () => {
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/macros/macro-1");

    renderTabs();

    expect(screen.getByRole("tab", { name: "common.overview" })).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  it("derives the active tab from the pathname, not from click state", () => {
    // A direct visit or a back-button landing must select Collaborators without
    // anyone having clicked it.
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/macros/macro-1/collaborators");

    renderTabs();

    expect(screen.getByRole("tab", { name: "sharing.collaboratorsTab" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByRole("tab", { name: "common.overview" })).toHaveAttribute(
      "data-state",
      "inactive",
    );
  });

  it("routes each resource type at its own plural", () => {
    renderTabs({ resourceType: "workbook", resourceId: "wb-1" });

    expect(screen.getByRole("tab", { name: "sharing.collaboratorsTab" })).toHaveAttribute(
      "href",
      "/en-US/platform/workbooks/wb-1/collaborators",
    );
  });
});
