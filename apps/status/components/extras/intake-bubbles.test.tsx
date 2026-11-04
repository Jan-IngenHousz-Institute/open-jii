import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOW, stubReducedMotion } from "~/test/test-utils";

import { IntakeBubbles } from "./intake-bubbles";

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function bubbleCount(container: HTMLElement) {
  return container.querySelectorAll("span.rounded-full").length;
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});

describe("IntakeBubbles", () => {
  it("keeps one release pending while it runs", () => {
    render(<IntakeBubbles messagesPerMinute={30} />);

    expect(vi.getTimerCount()).toBe(1);
  });

  it("clips the layer so bubbles stop short of the row's top divider", () => {
    const { container } = render(<IntakeBubbles messagesPerMinute={30} />);

    expect(container.firstElementChild?.className).toContain("[clip-path:inset(");
  });

  it("cancels the pending release on unmount", () => {
    const { unmount } = render(<IntakeBubbles messagesPerMinute={30} />);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops releasing after unmount even once the delay has passed", async () => {
    const { container, unmount } = render(<IntakeBubbles messagesPerMinute={30} />);

    unmount();
    await advance(10_000);

    expect(bubbleCount(container)).toBe(0);
  });

  it("restarts at the new pace when the rate changes, leaving one release pending", () => {
    const { rerender } = render(<IntakeBubbles messagesPerMinute={30} />);

    rerender(<IntakeBubbles messagesPerMinute={60} />);

    expect(vi.getTimerCount()).toBe(1);
  });

  it("stops releasing when the rate drops to nothing", () => {
    const { rerender } = render(<IntakeBubbles messagesPerMinute={30} />);

    rerender(<IntakeBubbles messagesPerMinute={0} />);

    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([undefined, 0])("releases nothing when the rate is %s", (rate) => {
    render(<IntakeBubbles messagesPerMinute={rate} />);

    expect(vi.getTimerCount()).toBe(0);
  });

  it("releases nothing under reduced motion", () => {
    stubReducedMotion(true);

    render(<IntakeBubbles messagesPerMinute={30} />);

    expect(vi.getTimerCount()).toBe(0);
  });
});
