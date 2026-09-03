import { render, screen, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { OrganizationResourceTotals } from "@repo/api/domains/organization/organization.schema";

import { OrganizationResourceMix } from "./organization-resource-mix";

const NO_TOTALS: OrganizationResourceTotals = {
  experiment: 0,
  protocol: 0,
  macro: 0,
  workbook: 0,
  device: 0,
  device_group: 0,
};

/**
 * The proportional segments, which are the only width-carrying elements in the card.
 * Scoped to the render's own container: the suite shares one jsdom document, so
 * querying it whole picks up whatever another file left behind.
 */
function segmentWidths(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>("[style*='width']")].map(
    (element) => element.style.width,
  );
}

describe("<OrganizationResourceMix />", () => {
  it("renders nothing when the organization owns nothing to proportion", () => {
    const { container } = render(<OrganizationResourceMix totals={NO_TOTALS} isMember />);

    expect(container).toBeEmptyDOMElement();
  });

  it("puts the total in the header — the number the resources stat tile used to carry", () => {
    render(
      <OrganizationResourceMix
        totals={{ ...NO_TOTALS, experiment: 4, protocol: 2, macro: 1, workbook: 1 }}
        isMember
      />,
    );

    expect(screen.getByRole("heading", { name: "organizations.mix.title" })).toBeVisible();
    expect(screen.getByText("organizations.resourceCount")).toBeVisible();
  });

  it("gives each type a segment proportional to its share", () => {
    const { container } = render(
      <OrganizationResourceMix
        totals={{ ...NO_TOTALS, experiment: 5, protocol: 3, macro: 1, workbook: 1 }}
        isMember
      />,
    );

    expect(segmentWidths(container)).toEqual(["50%", "30%", "10%", "10%"]);
  });

  it("leaves out the types the organization has none of", () => {
    const { container } = render(
      <OrganizationResourceMix totals={{ ...NO_TOTALS, experiment: 3, workbook: 1 }} isMember />,
    );

    // Two segments and two legend entries, not four of each with two at zero width.
    expect(segmentWidths(container)).toEqual(["75%", "25%"]);
    const legend = within(container).getAllByRole("listitem");
    expect(legend).toHaveLength(2);
    expect(legend.map((entry) => entry.textContent)).toEqual([
      "organizations.resources.types.experiment3",
      "organizations.resources.types.workbook1",
    ]);
  });

  it("reads every type in the resources card's order, hardware last", () => {
    const { container } = render(
      <OrganizationResourceMix
        totals={{ experiment: 1, protocol: 1, macro: 1, workbook: 1, device: 1, device_group: 1 }}
        isMember
      />,
    );

    // The order the card below groups by, so a segment and its group read the same way
    // — the two things you make, the two you write, then the hardware, a group directly
    // after the devices it holds.
    expect(
      within(container)
        .getAllByRole("listitem")
        .map((entry) => entry.textContent),
    ).toEqual([
      "organizations.resources.types.experiment1",
      "organizations.resources.types.protocol1",
      "organizations.resources.types.macro1",
      "organizations.resources.types.workbook1",
      "organizations.resources.types.device1",
      "organizations.resources.types.device_group1",
    ]);
  });

  /**
   * The case that makes devices worth counting: an organization that owns nothing but
   * devices used to render no mix at all and a resources card saying "nothing to show
   * yet", which between them claimed it owned nothing.
   */
  it("renders a full bar for an organization that owns only devices", () => {
    const { container } = render(
      <OrganizationResourceMix totals={{ ...NO_TOTALS, device: 4 }} isMember />,
    );

    expect(segmentWidths(container)).toEqual(["100%"]);
    const legend = within(container).getAllByRole("listitem");
    expect(legend).toHaveLength(1);
    expect(legend[0].textContent).toBe("organizations.resources.types.device4");
    // And the header total is the device count, not zero.
    expect(screen.getByText("organizations.resourceCount")).toBeVisible();
  });

  it("counts devices into the header total alongside the listed types", () => {
    const { container } = render(
      <OrganizationResourceMix totals={{ ...NO_TOTALS, experiment: 3, device: 1 }} isMember />,
    );

    // 3 of 4 and 1 of 4 — the device is in the denominator, so the bar and the header
    // are the same estate.
    expect(segmentWidths(container)).toEqual(["75%", "25%"]);
  });

  it("omits devices like any other type when the organization owns none", () => {
    const { container } = render(
      <OrganizationResourceMix totals={{ ...NO_TOTALS, experiment: 2, device: 0 }} isMember />,
    );

    expect(segmentWidths(container)).toEqual(["100%"]);
    expect(within(container).queryByText(/types\.device/u)).toBeNull();
  });

  describe("the header label", () => {
    const SAME_TOTALS = { ...NO_TOTALS, experiment: 3 };

    /** Same count either way; only the wording changes. */
    it("qualifies the count for a non-member and leaves it plain for a member", () => {
      const asMember = render(<OrganizationResourceMix totals={SAME_TOTALS} isMember />);
      expect(within(asMember.container).getByText("organizations.resourceCount")).toBeVisible();
      expect(
        within(asMember.container).queryByText("organizations.visibleResourceCount"),
      ).toBeNull();

      // Same totals, so the label is the only difference.
      const asVisitor = render(<OrganizationResourceMix totals={SAME_TOTALS} isMember={false} />);
      expect(
        within(asVisitor.container).getByText("organizations.visibleResourceCount"),
      ).toBeVisible();
      expect(within(asVisitor.container).queryByText("organizations.resourceCount")).toBeNull();
    });

    it("shows no denominator or total to either caller", () => {
      // A denominator would disclose the private estate's size.
      for (const isMember of [true, false]) {
        const { container } = render(
          <OrganizationResourceMix totals={SAME_TOTALS} isMember={isMember} />,
        );
        expect(container.textContent).not.toMatch(/\bof\b|\/|43/u);
      }
    });

    it("never says public, which would be false for a caller holding a grant", () => {
      // A non-member's count includes granted rows, so "public" would be false.
      const { container } = render(
        <OrganizationResourceMix totals={SAME_TOTALS} isMember={false} />,
      );

      expect(container.textContent).not.toMatch(/public/iu);
    });
  });

  it("survives a single type owning everything", () => {
    const { container } = render(
      <OrganizationResourceMix totals={{ ...NO_TOTALS, macro: 2 }} isMember />,
    );

    expect(segmentWidths(container)).toEqual(["100%"]);
  });
});
