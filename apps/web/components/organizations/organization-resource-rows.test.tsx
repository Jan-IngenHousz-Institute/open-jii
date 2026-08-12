import { createOrganizationResource } from "@/test/factories";
import { render, screen, userEvent, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { OrganizationResourceTotals } from "@repo/api/domains/organization/organization.schema";

import { OrganizationResourceRows } from "./organization-resource-rows";

const NO_TOTALS: OrganizationResourceTotals = {
  experiment: 0,
  protocol: 0,
  macro: 0,
  workbook: 0,
};

/** `n` experiments, named so the row order is checkable. */
function experiments(n: number) {
  return Array.from({ length: n }, (_, index) =>
    createOrganizationResource({ id: `exp-${index}`, name: `Experiment ${index}` }),
  );
}

function group(): HTMLElement {
  // The group is the only section; its heading names the type.
  const heading = screen.getByRole("heading", {
    name: /organizations.resources.types.experiment/u,
  });
  const section = heading.closest("section");
  if (!section) throw new Error("No resource group section found");
  return section;
}

describe("<OrganizationResourceRows />", () => {
  it("shows three rows and offers what is hidden, not the group's size", async () => {
    const user = userEvent.setup();
    // 6 rows: 3 shown, so the control offers the 3 it will reveal — not "6", which the
    // header already states.
    render(
      <OrganizationResourceRows
        resources={experiments(6)}
        totals={{ ...NO_TOTALS, experiment: 6 }}
      />,
    );

    expect(within(group()).getAllByRole("listitem")).toHaveLength(3);

    const trigger = screen.getByRole("button", {
      name: /organizations.resources.showMoreLabel/u,
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(within(group()).getAllByRole("listitem")).toHaveLength(6);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // The control becomes the way back.
    expect(
      screen.getByRole("button", { name: /organizations.resources.showLessLabel/u }),
    ).toBeVisible();

    await user.click(trigger);
    expect(within(group()).getAllByRole("listitem")).toHaveLength(3);
  });

  it("expands to exactly the total, with nothing left to disclose", async () => {
    const user = userEvent.setup();
    // The read is uncapped, so rows and total agree and expanding reveals all of them.
    render(
      <OrganizationResourceRows
        resources={experiments(5)}
        totals={{ ...NO_TOTALS, experiment: 5 }}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /organizations.resources.showMoreLabel/u }),
    );

    const rows = within(group()).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    // No shortfall note, because a shortfall can no longer occur.
    expect(within(group()).queryByText(/showing/iu)).toBeNull();
  });

  it("labels the timestamp and carries the absolute date for it", () => {
    render(
      <OrganizationResourceRows
        resources={[
          createOrganizationResource({ name: "Dated run", updatedAt: "2026-03-12T09:00:00.000Z" }),
        ]}
        totals={{ ...NO_TOTALS, experiment: 1 }}
      />,
    );

    // "2 days ago" alone does not say what happened then, and a row has two plausible
    // timestamps — so the word is part of the visible text.
    const stamp = within(group()).getByText(/common\.updated/u);
    expect(stamp).toHaveAttribute("dateTime", "2026-03-12T09:00:00.000Z");
    // A relative time is lossy on its own, so the exact date rides along.
    expect(stamp.getAttribute("title")).toMatch(/common\.updated .*2026/u);
  });

  it("reveals a single hidden row as readily as many", async () => {
    const user = userEvent.setup();
    // Four rows past a three-row preview is exactly one hidden — the case the seeded
    // organization produces, so it is the one worth pinning.
    render(
      <OrganizationResourceRows
        resources={experiments(4)}
        totals={{ ...NO_TOTALS, experiment: 4 }}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /organizations.resources.showMoreLabel/u }),
    );

    expect(within(group()).getAllByRole("listitem")).toHaveLength(4);
  });

  it("offers no control for a group that fits in the preview", () => {
    render(
      <OrganizationResourceRows
        resources={experiments(3)}
        totals={{ ...NO_TOTALS, experiment: 3 }}
      />,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(within(group()).getAllByRole("listitem")).toHaveLength(3);
  });

  it("expands each group independently", async () => {
    const user = userEvent.setup();
    render(
      <OrganizationResourceRows
        resources={[
          ...experiments(5),
          ...Array.from({ length: 5 }, (_, index) =>
            createOrganizationResource({
              type: "protocol",
              id: `pro-${index}`,
              name: `Protocol ${index}`,
              family: "multispeq",
            }),
          ),
        ]}
        totals={{ ...NO_TOTALS, experiment: 5, protocol: 5 }}
      />,
    );

    const triggers = screen.getAllByRole("button", {
      name: /organizations.resources.showMoreLabel/u,
    });
    expect(triggers).toHaveLength(2);

    await user.click(triggers[0]);

    // The experiments group opened; the protocols group did not.
    expect(triggers[0]).toHaveAttribute("aria-expanded", "true");
    expect(triggers[1]).toHaveAttribute("aria-expanded", "false");
  });

  it("strips markup out of a description rather than printing it", () => {
    render(
      <OrganizationResourceRows
        resources={[
          createOrganizationResource({
            name: "Rich run",
            // Experiment descriptions are authored in a rich editor, so this is the
            // shape that actually arrives — interpolated raw it printed literal tags.
            description: "<p>Twelve wheat plots, <strong>paired</strong> PAR logging.</p>",
          }),
        ]}
        totals={{ ...NO_TOTALS, experiment: 1 }}
      />,
    );

    expect(within(group()).getByText("Twelve wheat plots, paired PAR logging.")).toBeVisible();
    expect(within(group()).queryByText(/<p>|<strong>/u)).toBeNull();
  });

  it("carries each type's own meta and a lock only on private rows", () => {
    render(
      <OrganizationResourceRows
        resources={[
          createOrganizationResource({ name: "Stale run", status: "stale", visibility: "private" }),
          createOrganizationResource({
            type: "macro",
            name: "Batch fit",
            language: "r",
          }),
        ]}
        totals={{ ...NO_TOTALS, experiment: 1, macro: 1 }}
      />,
    );

    // All four statuses render, not only archived/active — and each meta badge wears
    // the colour that value already has elsewhere on the platform, not a plain outline.
    expect(screen.getByText("organizations.resources.status.stale")).toHaveClass("bg-badge-stale");
    // A language is a proper noun, so it is not translated and `r` is "R".
    expect(screen.getByText("R")).toHaveClass("bg-badge-stale");
    expect(screen.getByLabelText("resourceVisibility.privateStatus")).toBeVisible();
  });
});
