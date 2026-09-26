import { stubIntersectionObserver } from "@/test/intersection-observer";
import { render, screen } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LazyWidget } from "./lazy-widget";

describe("LazyWidget", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mounts its content only once the card comes into view, and keeps it mounted", () => {
    const { intersect, activeObservers } = stubIntersectionObserver();

    render(
      <LazyWidget>
        <div data-testid="content" />
      </LazyWidget>,
    );
    expect(screen.queryByTestId("content")).toBeNull();
    expect(activeObservers()).toBe(1);

    intersect(true);
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(activeObservers()).toBe(0);

    intersect(false);
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("starts loading a screen before the card scrolls in", () => {
    const { rootMargins } = stubIntersectionObserver();

    render(
      <LazyWidget>
        <div data-testid="content" />
      </LazyWidget>,
    );
    expect(rootMargins()).toEqual(["100% 0px"]);
  });

  it("renders straight away where IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);

    render(
      <LazyWidget>
        <div data-testid="content" />
      </LazyWidget>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });
});
