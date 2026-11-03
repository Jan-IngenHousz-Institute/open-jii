import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CELL } from "~/lib/history-cells";
import { componentOf } from "~/test/component-of";
import { renderWithTranslations } from "~/test/render-status";
import { incidentStatusDocument, operationalStatusDocument } from "~/test/status-fixtures";

import type { StatusComponent, StatusDocument } from "@repo/monitoring/status-document";

import { HistoryStrip } from "../history-strip";

const TODAY = "2026-11-03";

function renderStrip(document: StatusDocument, id: StatusComponent["id"], dayCount = 90) {
  const component = componentOf(document, id);

  renderWithTranslations(
    <HistoryStrip
      component={component}
      incidents={document.incidents}
      checksBegan={component.days.at(0)?.date ?? TODAY}
      dayCount={dayCount}
      describedBy=""
    />,
  );
}

function bars() {
  return within(screen.getByRole("group")).getAllByRole("img", { hidden: true });
}

function labelsOf() {
  return bars().map((bar) => bar.getAttribute("aria-label"));
}

function cardAround(text: HTMLElement) {
  const card = text.closest("[data-state='open']");
  if (!(card instanceof HTMLElement)) {
    throw new Error("the text is not in an open card");
  }

  return card;
}

describe("HistoryStrip", () => {
  describe("padding", () => {
    it("pads a shorter history to 90 bars with no-record days dated back from the first record", () => {
      renderStrip(operationalStatusDocument, "macro-processing");

      const labels = labelsOf();

      expect(labels).toHaveLength(90);
      expect(labels[0]).toBe("August 6, 2026: no record, checks began on August 12, 2026");
      expect(labels[5]).toBe("August 11, 2026: no record, checks began on August 12, 2026");
      expect(labels[6]).toBe("August 12, 2026: no downtime recorded");
      expect(labels[88]).toBe("November 2, 2026: no downtime recorded");
      expect(labels[89]).toBe("November 3, 2026, today so far: no downtime recorded");
      expect(labels.slice(0, 6).every((label) => label?.includes("no record"))).toBe(true);
    });

    it("draws the padded days as no record and the recorded ones by their state", () => {
      renderStrip(operationalStatusDocument, "macro-processing");

      expect(bars()[0]).toHaveClass(...CELL.none.split(" "));
      expect(bars()[6]).toHaveClass(...CELL.operational.split(" "));
    });

    it("adds nothing to a full history", () => {
      renderStrip(operationalStatusDocument, "website");

      expect(labelsOf()[0]).toBe("August 6, 2026: no downtime recorded");
    });

    it("names the group by its component and the days it shows", () => {
      renderStrip(operationalStatusDocument, "data-delivery");

      expect(
        screen.getByRole("group", { name: "Data delivery, last 90 days" }),
      ).toBeInTheDocument();
    });
  });

  describe("on a narrow viewport", () => {
    it("shows only the last 30 days, still ending today", () => {
      renderStrip(operationalStatusDocument, "website", 30);

      const labels = labelsOf();

      expect(labels).toHaveLength(30);
      expect(labels[0]).toBe("October 5, 2026: no downtime recorded");
      expect(labels[29]).toBe("November 3, 2026, today so far: no downtime recorded");
      expect(screen.getByRole("group", { name: "Website, last 30 days" })).toBeInTheDocument();
    });

    it("keeps the blips of the days it shows", () => {
      renderStrip(operationalStatusDocument, "data-intake", 30);

      expect(labelsOf()).toContain(
        "October 9, 2026: Outage for 25 min, checks could not run for 4 min",
      );
    });

    it("takes Home and End to the ends of the 30 days", async () => {
      const user = userEvent.setup();
      renderStrip(operationalStatusDocument, "website", 30);
      await user.tab();
      expect(bars()[29]).toHaveFocus();

      await user.keyboard("{Home}");
      expect(bars()[0]).toHaveFocus();
      expect(bars()[0]).toHaveAttribute("aria-label", expect.stringContaining("October 5, 2026"));

      await user.keyboard("{ArrowLeft}");
      expect(bars()[0]).toHaveFocus();

      await user.keyboard("{End}");
      expect(bars()[29]).toHaveFocus();

      await user.keyboard("{ArrowRight}");
      expect(bars()[29]).toHaveFocus();
    });
  });

  describe("spoken labels", () => {
    it("gives every recorded kind of minute", () => {
      renderStrip(operationalStatusDocument, "website");

      expect(labelsOf()).toContain("October 2, 2026: Outage for 42 min, Degraded for 9 min");
    });

    it("formats durations as hours and minutes", () => {
      renderStrip(operationalStatusDocument, "platform");

      expect(labelsOf()).toEqual(
        expect.arrayContaining([
          "August 21, 2026: Degraded for 1 h 35 min",
          "September 30, 2026: Maintenance for 1 h",
        ]),
      );
    });

    it("keeps a blip too short to colour its bar in the label", () => {
      renderStrip(operationalStatusDocument, "platform");

      const label = "September 12, 2026: Degraded for 4 min";

      expect(labelsOf()).toContain(label);
      expect(screen.getByLabelText(label)).toHaveClass(...CELL.operational.split(" "));
    });

    it("says when checks could not run", () => {
      renderStrip(operationalStatusDocument, "data-intake");

      expect(labelsOf()).toContain(
        "October 9, 2026: Outage for 25 min, checks could not run for 4 min",
      );
    });

    it("names the related incidents", () => {
      renderStrip(incidentStatusDocument, "data-intake");

      expect(labelsOf().at(-1)).toBe(
        "November 3, 2026, today so far: Outage for 38 min, related incidents: Measurements are not reaching the platform",
      );
    });
  });

  describe("assistive tech", () => {
    it("exposes only the current stop of the strip", () => {
      renderStrip(operationalStatusDocument, "website");

      const exposed = within(screen.getByRole("group")).getAllByRole("img");

      expect(exposed).toHaveLength(1);
      expect(exposed[0]).toBe(bars()[89]);
      expect(bars().filter((bar) => bar.getAttribute("aria-hidden") === "true")).toHaveLength(89);
    });

    it("passes the exposure on to the bar that takes the stop, and keeps every bar reachable", async () => {
      const user = userEvent.setup();
      renderStrip(operationalStatusDocument, "website");
      await user.tab();

      await user.keyboard("{ArrowLeft}");

      expect(within(screen.getByRole("group")).getAllByRole("img")).toEqual([bars()[88]]);
      expect(bars()[89]).toHaveAttribute("aria-hidden", "true");
      expect(bars()[89]?.tabIndex).toBe(-1);
      expect(bars()[88]).not.toHaveAttribute("aria-hidden");
    });

    it("keeps the card out of the strip and out of the accessibility tree", async () => {
      const user = userEvent.setup();
      renderStrip(incidentStatusDocument, "data-intake");

      await user.tab();

      const card = cardAround(
        await screen.findByText("Measurements are not reaching the platform"),
      );
      expect(card).toHaveAttribute("aria-hidden", "true");
      expect(screen.getByRole("group")).not.toContainElement(card);
    });

    it("leaves nothing in the card that the bar's label does not say", async () => {
      const user = userEvent.setup();
      renderStrip(incidentStatusDocument, "data-intake");

      await user.tab();

      const title = "Measurements are not reaching the platform";
      const card = within(cardAround(await screen.findByText(title)));
      const label = bars()[89]?.getAttribute("aria-label");
      for (const text of ["November 3, 2026", "Outage", "38 min", title]) {
        expect(card.getByText(text)).toBeInTheDocument();
        expect(label).toContain(text);
      }
    });
  });

  describe("keyboard", () => {
    it("is one tab stop, and Tab lands on today", async () => {
      const user = userEvent.setup();
      renderStrip(operationalStatusDocument, "website");

      expect(bars().filter((bar) => bar.tabIndex === 0)).toHaveLength(1);

      await user.tab();

      expect(bars()[89]).toHaveFocus();
    });

    it("moves with the arrow keys, Home and End, and stops at the ends", async () => {
      const user = userEvent.setup();
      renderStrip(operationalStatusDocument, "website");
      await user.tab();

      await user.keyboard("{ArrowLeft}");
      expect(bars()[88]).toHaveFocus();
      expect(bars()[88]?.tabIndex).toBe(0);
      expect(bars()[89]?.tabIndex).toBe(-1);

      await user.keyboard("{ArrowRight}");
      expect(bars()[89]).toHaveFocus();

      await user.keyboard("{ArrowRight}");
      expect(bars()[89]).toHaveFocus();

      await user.keyboard("{Home}");
      expect(bars()[0]).toHaveFocus();

      await user.keyboard("{ArrowLeft}");
      expect(bars()[0]).toHaveFocus();

      await user.keyboard("{End}");
      expect(bars()[89]).toHaveFocus();
    });

    it("moves on from the bar that was clicked, not from the one last reached by key", async () => {
      const user = userEvent.setup();
      renderStrip(operationalStatusDocument, "website");

      await user.click(bars()[40] ?? document.body);
      expect(bars()[40]).toHaveFocus();

      await user.keyboard("{ArrowRight}");
      expect(bars()[41]).toHaveFocus();

      await user.click(bars()[10] ?? document.body);
      await user.keyboard("{ArrowLeft}");
      expect(bars()[9]).toHaveFocus();

      await user.keyboard("{End}");
      expect(bars()[89]).toHaveFocus();
    });

    it("makes the clicked bar the tab stop", async () => {
      const user = userEvent.setup();
      renderStrip(operationalStatusDocument, "website");

      await user.click(bars()[40] ?? document.body);

      expect(bars().filter((bar) => bar.tabIndex === 0)).toEqual([bars()[40]]);
    });

    it("holds back the page's own scrolling for the keys it handles", () => {
      renderStrip(operationalStatusDocument, "website");
      const bar = bars()[89] ?? document.body;

      for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
        expect(fireEvent.keyDown(bar, { key }), key).toBe(false);
      }
    });

    it("leaves every other key alone", () => {
      renderStrip(operationalStatusDocument, "website");
      const bar = bars()[89] ?? document.body;

      for (const key of ["ArrowUp", "ArrowDown", "PageUp", "a", "Tab"]) {
        expect(fireEvent.keyDown(bar, { key }), key).toBe(true);
      }
    });

    it("leaves the strip on the next Tab", async () => {
      const user = userEvent.setup();
      renderStrip(operationalStatusDocument, "website");
      await user.tab();

      await user.tab();

      expect(bars().some((bar) => bar === document.activeElement)).toBe(false);
    });

    it("opens the day's card on focus and swaps it as the focus moves", async () => {
      const user = userEvent.setup();
      renderStrip(operationalStatusDocument, "macro-processing");

      await user.tab();
      expect(await screen.findByText("No downtime recorded on this day.")).toBeInTheDocument();
      expect(screen.getByText("November 3, 2026", { selector: "p" })).toBeInTheDocument();
      expect(screen.getByText("Today, so far")).toBeInTheDocument();

      await user.keyboard("{ArrowLeft}");
      expect(await screen.findByText("November 2, 2026", { selector: "p" })).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByText("Today, so far")).not.toBeInTheDocument();
      });

      await user.keyboard("{Home}");
      expect(
        await screen.findByText("No record, because checks began on August 12, 2026."),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByText("No downtime recorded on this day.")).not.toBeInTheDocument();
      });
    });

    it("lists each recorded kind of minute and the related incident in the card", async () => {
      const user = userEvent.setup();
      renderStrip(incidentStatusDocument, "data-intake");

      await user.tab();

      const outage = await screen.findByText("Outage", { selector: "span" });
      expect(within(outage.closest("li") ?? document.body).getByText("38 min")).toBeInTheDocument();
      expect(screen.getByText("Related")).toBeInTheDocument();
      expect(screen.getByText("Measurements are not reaching the platform")).toBeInTheDocument();
    });

    it("closes the card on Escape", async () => {
      const user = userEvent.setup();
      renderStrip(operationalStatusDocument, "macro-processing");
      await user.tab();
      expect(await screen.findByText("No downtime recorded on this day.")).toBeInTheDocument();

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByText("No downtime recorded on this day.")).not.toBeInTheDocument();
      });
    });
  });

  describe("hover", () => {
    it("opens the card on hover without a fade", async () => {
      const user = userEvent.setup();
      renderStrip(operationalStatusDocument, "website");
      const bar = screen.getByLabelText("October 2, 2026: Outage for 42 min, Degraded for 9 min");

      await user.hover(bar);

      const card = cardAround(await screen.findByText("42 min"));
      expect(card).toHaveClass("data-[state=open]:animate-none!");
      expect(screen.getByText("9 min")).toBeInTheDocument();
    });

    it("shows one day's card at a time as the pointer sweeps along the bars", async () => {
      const user = userEvent.setup();
      renderStrip(operationalStatusDocument, "website");

      await user.hover(bars()[87] ?? document.body);
      await screen.findByText("November 1, 2026", { selector: "p" });

      await user.hover(bars()[88] ?? document.body);
      await screen.findByText("November 2, 2026", { selector: "p" });

      await waitFor(() => {
        expect(screen.queryByText("November 1, 2026", { selector: "p" })).not.toBeInTheDocument();
      });
      expect(screen.getAllByText(/^November \d, 2026$/, { selector: "p" })).toHaveLength(1);
    });
  });

  describe("touch", () => {
    async function tap(user: ReturnType<typeof userEvent.setup>, target: Element) {
      await user.pointer({ keys: "[TouchA]", target });
    }

    it("opens the day's card with a tap", async () => {
      const user = userEvent.setup();
      renderStrip(operationalStatusDocument, "website");
      const bar = bars()[39] ?? document.body;

      await tap(user, bar);

      expect(await screen.findByText("September 14, 2026", { selector: "p" })).toBeInTheDocument();
      expect(screen.getByText("18 min")).toBeInTheDocument();
    });

    it("closes the card with a second tap on the same bar", async () => {
      const user = userEvent.setup();
      renderStrip(operationalStatusDocument, "website");
      const bar = bars()[39] ?? document.body;
      await tap(user, bar);
      await screen.findByText("September 14, 2026", { selector: "p" });

      await tap(user, bar);

      await waitFor(() => {
        expect(screen.queryByText("September 14, 2026", { selector: "p" })).not.toBeInTheDocument();
      });
    });

    it("moves the card to the bar tapped next", async () => {
      const user = userEvent.setup();
      renderStrip(operationalStatusDocument, "website");
      await tap(user, bars()[39] ?? document.body);
      await screen.findByText("September 14, 2026", { selector: "p" });

      await tap(user, bars()[40] ?? document.body);

      expect(await screen.findByText("September 15, 2026", { selector: "p" })).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByText("September 14, 2026", { selector: "p" })).not.toBeInTheDocument();
      });
    });

    it("closes the card with a tap elsewhere on the page", async () => {
      const user = userEvent.setup();
      renderStrip(operationalStatusDocument, "website");
      await tap(user, bars()[39] ?? document.body);
      await screen.findByText("September 14, 2026", { selector: "p" });

      await tap(user, document.body);

      await waitFor(() => {
        expect(screen.queryByText("September 14, 2026", { selector: "p" })).not.toBeInTheDocument();
      });
    });

    it("keeps the card open when the bar under the mouse is clicked", async () => {
      const user = userEvent.setup();
      renderStrip(operationalStatusDocument, "website");
      const bar = bars()[39] ?? document.body;
      await user.hover(bar);
      await screen.findByText("September 14, 2026", { selector: "p" });

      await user.click(bar);
      await user.click(bar);

      expect(await screen.findByText("September 14, 2026", { selector: "p" })).toBeInTheDocument();
    });
  });
});
