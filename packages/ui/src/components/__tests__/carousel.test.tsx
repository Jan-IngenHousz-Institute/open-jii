import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselRotationToggle,
} from "../carousel";

// jsdom lays nothing out, so a real Embla never moves. This one keeps three snaps without loop
// and announces each move the way Embla does.
const embla = vi.hoisted(() => {
  const listeners = new Map<string, Set<(api: unknown) => void>>();
  const state = { selected: 0, count: 3 };

  function select(index: number): void {
    state.selected = index;
    listeners.get("select")?.forEach((listener) => listener(api));
  }

  const api = {
    on: (event: string, listener: (api: unknown) => void) => {
      listeners.set(event, (listeners.get(event) ?? new Set()).add(listener));
    },
    off: (event: string, listener: (api: unknown) => void) => {
      listeners.get(event)?.delete(listener);
    },
    selectedScrollSnap: () => state.selected,
    scrollSnapList: () => Array.from({ length: state.count }, (_, index) => index),
    canScrollPrev: () => state.selected > 0,
    canScrollNext: () => state.selected < state.count - 1,
    scrollTo: vi.fn((index: number) => select(index)),
    scrollNext: vi.fn(() => select(state.selected + 1)),
    scrollPrev: vi.fn(() => select(state.selected - 1)),
  };

  const reset = () => {
    state.selected = 0;
    listeners.clear();
    api.scrollTo.mockClear();
    api.scrollNext.mockClear();
    api.scrollPrev.mockClear();
  };

  const viewportRef = () => undefined;

  return { api, reset, viewportRef };
});

vi.mock("embla-carousel-react", async () => {
  const { useEffect, useState } = await import("react");

  // Like Embla, the API arrives once the viewport has mounted.
  function useEmblaCarousel() {
    const [api, setApi] = useState<typeof embla.api>();
    useEffect(() => setApi(embla.api), []);
    return [embla.viewportRef, api];
  }

  return { default: useEmblaCarousel };
});

const SLIDES = ["First", "Second", "Third"];
const INTERVAL_MS = 6000;

function OneAtATime({
  rotateEvery,
  setApi,
}: {
  rotateEvery?: number;
  setApi?: (api: unknown) => void;
}) {
  const renderSlide = (name: string, index: number) => (
    <CarouselItem key={name} index={index} aria-label={name}>
      {name}
    </CarouselItem>
  );

  return (
    <Carousel rotateEvery={rotateEvery} setApi={setApi} aria-label="Figures">
      <CarouselContent data-testid="slides">{SLIDES.map(renderSlide)}</CarouselContent>
      <CarouselDots labels={SLIDES.map((name) => `Show ${name}`)} />
      <CarouselRotationToggle pauseLabel="Pause" resumeLabel="Resume" />
    </Carousel>
  );
}

function preferReducedMotion() {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

const current = () =>
  screen
    .getAllByRole("button", { name: /^Show / })
    .find((dot) => dot.getAttribute("aria-current") === "true")
    ?.getAttribute("aria-label");

describe("Carousel", () => {
  beforeEach(() => {
    embla.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps slides out of view from screen readers and Tab", () => {
    render(<OneAtATime />);

    const slides = screen.getAllByRole("group", { hidden: true });
    expect(slides[0]).not.toHaveAttribute("aria-hidden");
    expect(slides[1]).toHaveAttribute("aria-hidden", "true");
    expect(slides[1]).toHaveAttribute("inert");
    expect(screen.getAllByRole("group")).toHaveLength(1);
  });

  it("offers a dot per slide, and picking one shows that slide", () => {
    render(<OneAtATime />);

    expect(screen.getAllByRole("button", { name: /^Show / })).toHaveLength(3);
    expect(current()).toBe("Show First");

    fireEvent.click(screen.getByRole("button", { name: "Show Third" }));

    expect(embla.api.scrollTo).toHaveBeenLastCalledWith(2, false);
    expect(current()).toBe("Show Third");
    expect(screen.getByRole("group")).toHaveAccessibleName("Third");
  });

  it("moves with the arrow keys, and only with them", () => {
    render(<OneAtATime />);
    const carousel = screen.getByRole("region", { name: "Figures" });

    fireEvent.keyDown(carousel, { key: "Enter" });
    expect(current()).toBe("Show First");

    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(embla.api.scrollNext).toHaveBeenLastCalledWith(false);
    expect(current()).toBe("Show Second");

    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(embla.api.scrollPrev).toHaveBeenLastCalledWith(false);
    expect(current()).toBe("Show First");
  });

  it("jumps instead of sliding for a reader who asked for less motion", () => {
    preferReducedMotion();
    render(<OneAtATime />);

    fireEvent.keyDown(screen.getByRole("region", { name: "Figures" }), { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "Show Third" }));

    expect(embla.api.scrollNext).toHaveBeenLastCalledWith(true);
    expect(embla.api.scrollTo).toHaveBeenLastCalledWith(2, true);
  });

  it("hands its API to setApi", () => {
    const setApi = vi.fn();

    render(<OneAtATime setApi={setApi} />);

    expect(setApi).toHaveBeenCalledWith(embla.api);
  });

  it("has no toggle and no live region when it does not rotate", () => {
    render(<OneAtATime />);

    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    expect(screen.getByTestId("slides")).not.toHaveAttribute("aria-live");
  });

  it("rotates through the slides and, without loop, starts over after the last", () => {
    vi.useFakeTimers();
    render(<OneAtATime rotateEvery={INTERVAL_MS} />);

    const visited = [current()];
    for (let step = 0; step < 3; step++) {
      act(() => {
        vi.advanceTimersByTime(INTERVAL_MS);
      });
      visited.push(current());
    }

    expect(visited).toEqual(["Show First", "Show Second", "Show Third", "Show First"]);
    expect(embla.api.scrollTo).toHaveBeenLastCalledWith(0, false);
  });

  it("lets the reader pause a rotating carousel, which then announces its slides", () => {
    render(<OneAtATime rotateEvery={INTERVAL_MS} />);

    expect(screen.getByTestId("slides")).toHaveAttribute("aria-live", "off");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByTestId("slides")).toHaveAttribute("aria-live", "polite");
  });
});
