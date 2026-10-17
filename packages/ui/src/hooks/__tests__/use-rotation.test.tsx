import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRotation } from "../use-rotation";

const INTERVAL_MS = 6000;

function Harness({ count }: { count: number }) {
  const [position, setPosition] = useState(0);
  const advance = () => setPosition((current) => (current + 1) % count);
  const rotation = useRotation({
    intervalMs: INTERVAL_MS,
    onAdvance: advance,
    position,
    canRotate: count > 1,
  });

  return (
    <>
      <div
        data-testid="content"
        data-position={position}
        data-rotating={String(rotation.isRotating)}
        {...rotation.holdHandlers}
      >
        <button type="button" onClick={rotation.toggleRunning}>
          {rotation.isRunning ? "pause" : "play"}
        </button>
        <button type="button">inside</button>
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

// One step per interval: each move restarts the timer once React has rendered it.
const wait = (intervals = 1) => {
  for (let step = 0; step < intervals; step++) {
    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS);
    });
  }
};

const position = () => screen.getByTestId("content").getAttribute("data-position");

describe("useRotation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("PointerEvent", StubPointerEvent);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("moves on after each interval", () => {
    render(<Harness count={3} />);

    wait(2);

    expect(position()).toBe("2");
  });

  it("holds while a mouse is over it", () => {
    render(<Harness count={3} />);

    fireEvent.pointerEnter(screen.getByTestId("content"), { pointerType: "mouse" });
    wait(3);
    expect(position()).toBe("0");

    fireEvent.pointerLeave(screen.getByTestId("content"), { pointerType: "mouse" });
    wait();
    expect(position()).toBe("1");
  });

  it("keeps going after a tap, which never sends a leave", () => {
    render(<Harness count={3} />);

    fireEvent.pointerEnter(screen.getByTestId("content"), { pointerType: "touch" });
    wait();

    expect(position()).toBe("1");
  });

  it("holds while focus moves inside it, and goes on once focus leaves", () => {
    render(<Harness count={3} />);

    act(() => screen.getByRole("button", { name: "pause" }).focus());
    act(() => screen.getByRole("button", { name: "inside" }).focus());
    wait(3);
    expect(position()).toBe("0");

    act(() => screen.getByRole("button", { name: "outside" }).focus());
    wait();
    expect(position()).toBe("1");
  });

  it("holds on focus even when a mouse passes over and leaves", () => {
    render(<Harness count={3} />);

    act(() => screen.getByRole("button", { name: "inside" }).focus());
    fireEvent.pointerEnter(screen.getByTestId("content"), { pointerType: "mouse" });
    fireEvent.pointerLeave(screen.getByTestId("content"), { pointerType: "mouse" });
    wait(3);

    expect(position()).toBe("0");
  });

  it("reports itself still while held, though the reader's play stays on", () => {
    render(<Harness count={3} />);

    act(() => screen.getByRole("button", { name: "inside" }).focus());
    expect(screen.getByTestId("content")).toHaveAttribute("data-rotating", "false");
    expect(screen.getByRole("button", { name: "pause" })).toBeInTheDocument();

    act(() => screen.getByRole("button", { name: "outside" }).focus());
    expect(screen.getByTestId("content")).toHaveAttribute("data-rotating", "true");
  });

  it("stops when the reader pauses it, and goes on when they resume", () => {
    render(<Harness count={3} />);

    fireEvent.click(screen.getByRole("button", { name: "pause" }));
    act(() => screen.getByRole("button", { name: "outside" }).focus());
    wait(3);
    expect(position()).toBe("0");

    fireEvent.click(screen.getByRole("button", { name: "play" }));
    wait();
    expect(position()).toBe("1");
  });

  it("goes on when play is pressed from inside, with focus and the mouse still there", () => {
    render(<Harness count={3} />);
    const toggle = screen.getByRole("button", { name: "pause" });

    fireEvent.click(toggle);
    fireEvent.pointerEnter(screen.getByTestId("content"), { pointerType: "mouse" });
    act(() => toggle.focus());
    fireEvent.click(toggle);
    wait();
    expect(position()).toBe("1");

    // Focus arriving somewhere else inside holds it again.
    act(() => screen.getByRole("button", { name: "inside" }).focus());
    wait(3);
    expect(position()).toBe("1");
  });

  it("starts paused for a reader who asked for less motion, until they press play", () => {
    preferReducedMotion();
    render(<Harness count={3} />);

    wait(3);
    expect(position()).toBe("0");

    const toggle = screen.getByRole("button", { name: "play" });
    act(() => toggle.focus());
    fireEvent.click(toggle);
    wait();
    expect(position()).toBe("1");
  });

  it("does not rotate a single item", () => {
    render(<Harness count={1} />);

    wait(3);

    expect(screen.getByTestId("content")).toHaveAttribute("data-rotating", "false");
  });
});
