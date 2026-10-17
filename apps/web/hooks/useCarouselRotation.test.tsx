import { act, fireEvent, render, screen } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCarouselRotation } from "./useCarouselRotation";
import type { RotatableCarousel } from "./useCarouselRotation";

const INTERVAL_MS = 6000;

/** A carousel of `count` slides that announces each move, as Embla does. */
function fakeCarousel(count: number) {
  const listeners = new Set<() => void>();
  let index = 0;
  const moveTo = (next: number) => {
    index = next;
    listeners.forEach((listener) => listener());
  };

  return {
    on: (_event: "select", callback: () => void) => listeners.add(callback),
    off: (_event: "select", callback: () => void) => listeners.delete(callback),
    selectedScrollSnap: () => index,
    scrollSnapList: () => Array.from({ length: count }, (_, slide) => slide),
    scrollNext: vi.fn((_jump?: boolean) => moveTo((index + 1) % count)),
    scrollTo: vi.fn((next: number, _jump?: boolean) => moveTo(next)),
  };
}

function Harness({ carousel }: { carousel: RotatableCarousel }) {
  const rotation = useCarouselRotation(carousel, INTERVAL_MS);
  const showLast = () => rotation.showSlide(2);

  return (
    <>
      <div
        data-testid="carousel"
        data-rotating={String(rotation.isRotating)}
        {...rotation.holdHandlers}
      >
        <button type="button" onClick={rotation.toggleRunning}>
          {rotation.isRunning ? "pause" : "play"}
        </button>
        <button type="button" onClick={showLast}>
          last
        </button>
      </div>
      <button type="button">outside</button>
    </>
  );
}

/** jsdom has no PointerEvent, so a fired pointer event would carry no `pointerType`. */
class StubPointerEvent extends MouseEvent {
  readonly pointerType: string;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerType = init.pointerType ?? "";
  }
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

const wait = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe("useCarouselRotation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("PointerEvent", StubPointerEvent);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("moves to the next slide after each interval", () => {
    const carousel = fakeCarousel(3);
    render(<Harness carousel={carousel} />);

    // One step per interval: each move restarts the timer once React has rendered it.
    wait(INTERVAL_MS);
    wait(INTERVAL_MS);

    expect(carousel.scrollNext).toHaveBeenCalledTimes(2);
    expect(carousel.scrollNext).toHaveBeenCalledWith(false);
  });

  it("holds while a mouse is over it", () => {
    const carousel = fakeCarousel(3);
    render(<Harness carousel={carousel} />);

    fireEvent.pointerEnter(screen.getByTestId("carousel"), { pointerType: "mouse" });
    wait(INTERVAL_MS * 3);
    expect(carousel.scrollNext).not.toHaveBeenCalled();

    fireEvent.pointerLeave(screen.getByTestId("carousel"), { pointerType: "mouse" });
    wait(INTERVAL_MS);
    expect(carousel.scrollNext).toHaveBeenCalledTimes(1);
  });

  it("keeps going after a tap, which never sends a leave", () => {
    const carousel = fakeCarousel(3);
    render(<Harness carousel={carousel} />);

    fireEvent.pointerEnter(screen.getByTestId("carousel"), { pointerType: "touch" });
    wait(INTERVAL_MS);

    expect(carousel.scrollNext).toHaveBeenCalledTimes(1);
  });

  it("holds while focus moves inside it, and goes on once focus leaves", () => {
    const carousel = fakeCarousel(3);
    render(<Harness carousel={carousel} />);

    act(() => screen.getByRole("button", { name: "pause" }).focus());
    act(() => screen.getByRole("button", { name: "last" }).focus());
    wait(INTERVAL_MS * 3);
    expect(carousel.scrollNext).not.toHaveBeenCalled();

    act(() => screen.getByRole("button", { name: "outside" }).focus());
    wait(INTERVAL_MS);
    expect(carousel.scrollNext).toHaveBeenCalledTimes(1);
  });

  it("holds on focus even when a mouse passes over and leaves", () => {
    const carousel = fakeCarousel(3);
    render(<Harness carousel={carousel} />);

    act(() => screen.getByRole("button", { name: "pause" }).focus());
    fireEvent.pointerEnter(screen.getByTestId("carousel"), { pointerType: "mouse" });
    fireEvent.pointerLeave(screen.getByTestId("carousel"), { pointerType: "mouse" });
    wait(INTERVAL_MS * 3);

    expect(carousel.scrollNext).not.toHaveBeenCalled();
  });

  it("reports itself still while held, though the reader's play stays on", () => {
    const carousel = fakeCarousel(3);
    render(<Harness carousel={carousel} />);

    act(() => screen.getByRole("button", { name: "last" }).focus());

    expect(screen.getByTestId("carousel")).toHaveAttribute("data-rotating", "false");
    expect(screen.getByRole("button", { name: "pause" })).toBeInTheDocument();

    act(() => screen.getByRole("button", { name: "outside" }).focus());

    expect(screen.getByTestId("carousel")).toHaveAttribute("data-rotating", "true");
  });

  it("stops when the reader pauses it, and goes on when they resume", () => {
    const carousel = fakeCarousel(3);
    render(<Harness carousel={carousel} />);

    fireEvent.click(screen.getByRole("button", { name: "pause" }));
    act(() => screen.getByRole("button", { name: "outside" }).focus());
    wait(INTERVAL_MS * 3);
    expect(carousel.scrollNext).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "play" }));
    act(() => screen.getByRole("button", { name: "outside" }).focus());
    wait(INTERVAL_MS);
    expect(carousel.scrollNext).toHaveBeenCalledTimes(1);
  });

  it("starts still for a reader who asked for less motion, and then changes without sliding", () => {
    preferReducedMotion();
    const carousel = fakeCarousel(3);
    render(<Harness carousel={carousel} />);

    expect(screen.getByRole("button", { name: "play" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "last" }));
    expect(carousel.scrollTo).toHaveBeenCalledWith(2, true);

    fireEvent.click(screen.getByRole("button", { name: "play" }));
    act(() => screen.getByRole("button", { name: "outside" }).focus());
    wait(INTERVAL_MS);
    expect(carousel.scrollNext).toHaveBeenCalledWith(true);
  });

  it("does not rotate a single slide", () => {
    const carousel = fakeCarousel(1);
    render(<Harness carousel={carousel} />);

    wait(INTERVAL_MS * 3);

    expect(carousel.scrollNext).not.toHaveBeenCalled();
  });
});
