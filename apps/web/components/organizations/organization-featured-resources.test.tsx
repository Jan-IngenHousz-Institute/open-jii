import { createOrganizationResource } from "@/test/factories";
import { render, screen, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { OrganizationFeaturedResources } from "./organization-featured-resources";

describe("<OrganizationFeaturedResources />", () => {
  it("renders nothing at all for an organization with no resources", () => {
    // No empty state: the resources card below already carries one, and two of them
    // stacked would say the same thing twice.
    const { container } = render(<OrganizationFeaturedResources resources={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("caps at six cards, each linking to the resource's own page", () => {
    const resources = Array.from({ length: 9 }, (_, index) =>
      createOrganizationResource({
        id: `exp-${index}`,
        name: `Experiment ${index}`,
        collaboratorCount: 9 - index,
      }),
    );

    const { container } = render(<OrganizationFeaturedResources resources={resources} />);

    const cards = within(container).getAllByRole("listitem");
    expect(cards).toHaveLength(6);
    expect(screen.getByRole("link", { name: /Experiment 0/u })).toHaveAttribute(
      "href",
      "/en-US/platform/experiments/exp-0",
    );
  });

  it("links each type to its own platform section", () => {
    render(
      <OrganizationFeaturedResources
        resources={[
          createOrganizationResource({ type: "protocol", id: "p1", name: "Dark adaptation" }),
          createOrganizationResource({ type: "macro", id: "m1", name: "Batch fit" }),
          createOrganizationResource({ type: "workbook", id: "w1", name: "Canopy synthesis" }),
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: /Dark adaptation/u })).toHaveAttribute(
      "href",
      "/en-US/platform/protocols/p1",
    );
    expect(screen.getByRole("link", { name: /Batch fit/u })).toHaveAttribute(
      "href",
      "/en-US/platform/macros/m1",
    );
    expect(screen.getByRole("link", { name: /Canopy synthesis/u })).toHaveAttribute(
      "href",
      "/en-US/platform/workbooks/w1",
    );
  });

  it("strips markup out of a rich-text description rather than printing it", () => {
    const { container } = render(
      <OrganizationFeaturedResources
        resources={[
          createOrganizationResource({
            name: "Drought stress",
            description: "<p>Rain-out shelter, <strong>12 plots</strong></p>",
          }),
        ]}
      />,
    );

    // The tags are gone and no element was created from them: a rich-text renderer here
    // would ignore the line clamp and blow the card's height.
    expect(within(container).getByText("Rain-out shelter, 12 plots")).toBeVisible();
    expect(within(container).queryByText(/<p>|<strong>/u)).toBeNull();
    expect(container.querySelector("strong")).toBeNull();
  });

  it("stands a placeholder in for a missing description, so cards keep one height", () => {
    const { container } = render(
      <OrganizationFeaturedResources
        resources={[
          createOrganizationResource({ type: "device", name: "Ambyte 04", description: null }),
          createOrganizationResource({ name: "Drought stress", description: "Rain-out shelter" }),
        ]}
      />,
    );

    // A device has no description column at all, so this is the one that would otherwise
    // render a shorter card than its neighbour in the grid.
    expect(within(container).getByText("organizations.resources.noDescription")).toBeVisible();
    // Not vacuous: a resource that has a description shows it rather than the placeholder.
    expect(within(container).getByText("Rain-out shelter")).toBeVisible();
    expect(within(container).getAllByText("organizations.resources.noDescription")).toHaveLength(1);
  });

  it("marks a private resource with the lock, and says nothing about a public one", () => {
    const { container } = render(
      <OrganizationFeaturedResources
        resources={[
          createOrganizationResource({ id: "a", name: "Closed", visibility: "private" }),
          createOrganizationResource({ id: "b", name: "Open", visibility: "public" }),
        ]}
      />,
    );

    // Only when private: public is the unremarkable default, which is how the resources
    // card below states the same fact — not the design's badge on every card.
    expect(within(container).getAllByLabelText("resourceVisibility.privateStatus")).toHaveLength(1);
  });

  it("states the collaborator count the server gave it, per card", () => {
    const { container } = render(
      <OrganizationFeaturedResources
        resources={[
          createOrganizationResource({ id: "a", name: "Busy", collaboratorCount: 7 }),
          createOrganizationResource({ id: "b", name: "Quiet", collaboratorCount: 1 }),
        ]}
      />,
    );

    const busy = screen.getByRole("link", { name: /Busy/u });
    // The stub `t()` returns the key, so the count rides in as the interpolation object.
    expect(within(busy).getByText(/collaboratorCount/u)).toBeVisible();
    expect(
      within(container).getAllByText(/organizations\.featured\.collaboratorCount/u),
    ).toHaveLength(2);
  });

  it("carries no measurement count — that data does not live in Postgres", () => {
    const { container } = render(
      <OrganizationFeaturedResources
        resources={[createOrganizationResource({ name: "Drought stress" })]}
      />,
    );

    expect(within(container).queryByText(/measurement/iu)).toBeNull();
  });
});
