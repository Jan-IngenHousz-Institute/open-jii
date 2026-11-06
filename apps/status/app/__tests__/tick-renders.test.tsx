import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOW, renderWithProviders, stubStatusFetch } from "~/test/test-utils";

import { operationalStatusDocument } from "@repo/monitoring/status-fixtures";

import Page from "../page";

const sectionRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock("~/components/component-list/components-section", async () => {
  const { memo } = await import("react");

  return {
    ComponentsSection: memo(function ComponentsSection() {
      sectionRenders.count += 1;

      return null;
    }),
  };
});

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function renderPage(generatedAt = operationalStatusDocument.generatedAt) {
  const stub = stubStatusFetch({ ...operationalStatusDocument, generatedAt });
  renderWithProviders(<Page />);
  await advance(0);

  return stub;
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW + 50_000 });
  sectionRenders.count = 0;
});

describe("the page's clock ticks", () => {
  it("move the text that reads the time without rendering the components again", async () => {
    await renderPage();
    const rendersAfterLoad = sectionRenders.count;
    expect(screen.getByText(/Last checked at 12:00 UTC, 2 min ago/)).toBeInTheDocument();

    await advance(30_000);

    expect(screen.getByText(/Last checked at 12:00 UTC, 3 min ago/)).toBeInTheDocument();
    expect(sectionRenders.count).toBe(rendersAfterLoad);
  });

  // A window nobody closed runs up to the document's time, so each new document draws the bars again.
  it("render the components again only when a new document arrives", async () => {
    const { respondWith } = await renderPage();
    const rendersAfterLoad = sectionRenders.count;

    respondWith({ ...operationalStatusDocument, generatedAt: "2026-11-03T12:03:00.000Z" });
    await advance(60_000);

    expect(sectionRenders.count).toBe(rendersAfterLoad + 1);
  });

  it("render the components again once, when the data turns stale", async () => {
    const { respondWith } = await renderPage("2026-11-03T11:58:30.000Z");
    const rendersAfterLoad = sectionRenders.count;
    respondWith("fails");

    await advance(30_000);
    expect(sectionRenders.count).toBe(rendersAfterLoad);

    await advance(30_000);
    expect(screen.getByText("Status may be out of date")).toBeInTheDocument();
    const rendersWhenStale = sectionRenders.count;
    expect(rendersWhenStale).toBeGreaterThan(rendersAfterLoad);

    await advance(60_000);
    expect(sectionRenders.count).toBe(rendersWhenStale);
  });
});
