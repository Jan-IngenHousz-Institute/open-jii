import { act, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NOW,
  renderWithTranslations,
  stubReducedMotion,
  stubStatusFetch,
} from "~/test/render-status";
import {
  incidentStatusDocument,
  operationalStatusDocument,
  staleStatusDocument,
} from "~/test/status-fixtures";

import type { StatusDocument } from "@repo/monitoring/status-document";

import Page from "../page";

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

async function renderPage(document: StatusDocument) {
  stubStatusFetch(document);
  renderWithTranslations(<Page />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

function strip(name: string) {
  return within(screen.getByRole("group", { name: `${name}, last 90 days` }));
}

function enterKonamiCode() {
  for (const key of KONAMI) {
    fireEvent.keyDown(window, { key });
  }
}

function bubbleCount() {
  return document.querySelectorAll("span.rounded-full").length;
}

function leafCount() {
  return document.querySelectorAll("svg.lucide-leaf").length;
}

async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

describe("the leaf beside the Data intake badge", () => {
  it("shows only when every component is operational", async () => {
    await renderPage(operationalStatusDocument);

    expect(leafCount()).toBe(1);
    expect(
      within(
        screen.getByRole("heading", { name: "Data intake" }).closest("[data-state]") ??
          document.body,
      ).getByText("Operational"),
    ).toBeInTheDocument();
  });

  it("is gone while anything is degraded or down", async () => {
    await renderPage(incidentStatusDocument);

    expect(leafCount()).toBe(0);
  });

  it("is gone while the data is stale, though every component last read operational", async () => {
    await renderPage(staleStatusDocument);

    expect(leafCount()).toBe(0);
  });

  it("goes when the data turns stale while the page is open", async () => {
    await renderPage({ ...operationalStatusDocument, generatedAt: "2026-11-03T11:57:30.000Z" });
    expect(leafCount()).toBe(1);

    await wait(60_000);

    expect(leafCount()).toBe(0);
  });

  describe("bubbles", () => {
    beforeEach(() => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
    });

    it("rise at the pace the document reports", async () => {
      await renderPage({ ...operationalStatusDocument, messagesPerMinute: 30 });

      await wait(4200);

      expect(bubbleCount()).toBe(3);
    });

    it("come slower when fewer messages arrive", async () => {
      await renderPage({ ...operationalStatusDocument, messagesPerMinute: 6 });

      await wait(4200);

      expect(bubbleCount()).toBe(0);
    });

    it("stay at about one a second however busy the platform is", async () => {
      await renderPage({ ...operationalStatusDocument, messagesPerMinute: 6000 });

      await wait(4200);

      expect(bubbleCount()).toBe(6);
    });

    it("do not rise when no messages arrive", async () => {
      await renderPage({ ...operationalStatusDocument, messagesPerMinute: 0 });

      await wait(30_000);

      expect(bubbleCount()).toBe(0);
    });

    it("do not rise when the document gives no pace", async () => {
      await renderPage({ ...operationalStatusDocument, messagesPerMinute: undefined });

      await wait(30_000);

      expect(bubbleCount()).toBe(0);
    });

    it("do not rise under reduced motion", async () => {
      stubReducedMotion(true);
      await renderPage({ ...operationalStatusDocument, messagesPerMinute: 60 });

      await wait(30_000);

      expect(leafCount()).toBe(1);
      expect(bubbleCount()).toBe(0);
    });

    it("do not rise while anything is degraded or down", async () => {
      await renderPage({ ...incidentStatusDocument, messagesPerMinute: 60 });

      await wait(30_000);

      expect(bubbleCount()).toBe(0);
    });

    it("do not rise while the data is stale", async () => {
      await renderPage({ ...staleStatusDocument, messagesPerMinute: 60 });

      await wait(30_000);

      expect(bubbleCount()).toBe(0);
    });
  });
});

describe("the Konami code", () => {
  it("knocks the bars over one after another when everything is operational", async () => {
    await renderPage(operationalStatusDocument);

    enterKonamiCode();

    const bars = strip("Website").getAllByRole("img", { hidden: true });
    expect(bars[0]).toHaveClass("animate-domino-fall");
    expect(bars[0]).toHaveStyle({ animationDelay: "0ms" });
    expect(bars[1]).toHaveStyle({ animationDelay: "25ms" });
    expect(bars[89]).toHaveClass("animate-domino-fall-flat");
  });

  it("stands them back up afterwards", async () => {
    await renderPage(operationalStatusDocument);
    enterKonamiCode();

    await wait(3300);

    expect(strip("Website").getAllByRole("img", { hidden: true })[0]).toHaveClass(
      "animate-domino-rise",
    );

    await wait(2000);

    expect(strip("Website").getAllByRole("img", { hidden: true })[0]).not.toHaveClass(
      "animate-domino-rise",
    );
  });

  it("needs the whole code in order", async () => {
    await renderPage(operationalStatusDocument);

    for (const key of KONAMI.slice(0, 9)) {
      fireEvent.keyDown(window, { key });
    }
    fireEvent.keyDown(window, { key: "x" });

    expect(strip("Website").getAllByRole("img", { hidden: true })[0]).not.toHaveClass(
      "animate-domino-fall",
    );
  });

  it("does nothing under reduced motion", async () => {
    stubReducedMotion(true);
    await renderPage(operationalStatusDocument);

    enterKonamiCode();

    expect(strip("Website").getAllByRole("img", { hidden: true })[0]).not.toHaveClass(
      "animate-domino-fall",
    );
  });

  it("does nothing while anything is degraded or down", async () => {
    await renderPage(incidentStatusDocument);

    enterKonamiCode();

    expect(strip("Website").getAllByRole("img", { hidden: true })[0]).not.toHaveClass(
      "animate-domino-fall",
    );
  });

  it("does nothing while the data is stale", async () => {
    await renderPage(staleStatusDocument);

    enterKonamiCode();

    expect(strip("Website").getAllByRole("img", { hidden: true })[0]).not.toHaveClass(
      "animate-domino-fall",
    );
  });
});
