import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryStrip } from "~/components/history/history-strip";
import { componentOf } from "~/test/component-of";
import { renderWithProviders, stubReducedMotion } from "~/test/test-utils";

import { operationalStatusDocument } from "@repo/monitoring/status-fixtures";

import { Dominoes, dominoAnimation, useDominoes } from "./dominoes";

const CODE = [
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

const RISE_AT_MS = 3300;
const DONE_AT_MS = 4788;

function Probe() {
  return <p data-testid="run">{useDominoes().run ?? "idle"}</p>;
}

function Switched({ children }: { children: ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(true);

  return (
    <>
      <button onClick={() => setIsEnabled(false)}>switch off</button>
      <Dominoes isEnabled={isEnabled}>{children}</Dominoes>
    </>
  );
}

function renderDominoes(isEnabled = true) {
  return render(
    <Dominoes isEnabled={isEnabled}>
      <Probe />
    </Dominoes>,
  );
}

function press(keys: string[], init: KeyboardEventInit = {}) {
  for (const key of keys) {
    fireEvent.keyDown(window, { key, ...init });
  }
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function run() {
  return screen.getByTestId("run").textContent;
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe("Dominoes", () => {
  describe("the code", () => {
    it("topples the bars, stands them back up and rests", () => {
      renderDominoes();
      expect(run()).toBe("idle");

      press(CODE);
      expect(run()).toBe("fall");

      wait(RISE_AT_MS);
      expect(run()).toBe("rise");

      wait(DONE_AT_MS - RISE_AT_MS - 1);
      expect(run()).toBe("rise");

      wait(1);
      expect(run()).toBe("idle");
    });

    it("takes capital letters and the Shift key pressed on the way", () => {
      renderDominoes();

      press(CODE.slice(0, 8));
      press(["Shift"]);
      press(["B"], { shiftKey: true });
      press(["Shift"]);
      press(["A"], { shiftKey: true });

      expect(run()).toBe("fall");
    });

    it("needs every key of it", () => {
      renderDominoes();

      press(CODE.slice(0, 9));

      expect(run()).toBe("idle");
    });

    it("can be retried straight after a wrong key", () => {
      renderDominoes();
      press(CODE.slice(0, 9));
      press(["x"]);
      expect(run()).toBe("idle");

      press(CODE);

      expect(run()).toBe("fall");
    });

    it("works after extra presses of its first key", () => {
      renderDominoes();

      press(["ArrowUp", ...CODE]);

      expect(run()).toBe("fall");
    });

    it("works when the wrong key sits inside a repeat of the start", () => {
      renderDominoes();

      press([...CODE.slice(0, 4), "ArrowUp", ...CODE]);

      expect(run()).toBe("fall");
    });

    it("ignores keys pressed with Ctrl, Meta or Alt", () => {
      renderDominoes();

      for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
        press(CODE, { [modifier]: true });
      }
      expect(run()).toBe("idle");

      press(CODE.slice(0, 5));
      press(["ArrowRight"], { ctrlKey: true });
      press(CODE.slice(6));
      expect(run()).toBe("idle");
    });

    it("does nothing under reduced motion", () => {
      stubReducedMotion(true);
      renderDominoes();

      press(CODE);

      expect(run()).toBe("idle");
    });

    it("does nothing while disabled", () => {
      renderDominoes(false);

      press(CODE);

      expect(run()).toBe("idle");
    });
  });

  describe("while a run plays", () => {
    it("does not start another when the code is entered again", () => {
      renderDominoes();
      press(CODE);
      expect(vi.getTimerCount()).toBe(2);

      wait(1000);
      press(CODE);

      expect(vi.getTimerCount()).toBe(2);
      wait(RISE_AT_MS - 1000);
      expect(run()).toBe("rise");
    });

    it("takes the code again once the run is over", () => {
      renderDominoes();
      press(CODE);
      wait(DONE_AT_MS);
      expect(run()).toBe("idle");

      press(CODE);

      expect(run()).toBe("fall");
    });

    it("stands the bars up at once when the extras are switched off", () => {
      const { rerender } = renderDominoes();
      press(CODE);
      expect(run()).toBe("fall");

      rerender(
        <Dominoes isEnabled={false}>
          <Probe />
        </Dominoes>,
      );

      expect(run()).toBe("idle");
      expect(vi.getTimerCount()).toBe(0);
    });

    it("stops listening for the code when the extras are switched off", () => {
      const { rerender } = renderDominoes();

      rerender(
        <Dominoes isEnabled={false}>
          <Probe />
        </Dominoes>,
      );
      press(CODE);

      expect(run()).toBe("idle");
    });

    it("clears its timers when it unmounts", () => {
      const { unmount } = renderDominoes();
      press(CODE);
      expect(vi.getTimerCount()).toBe(2);

      unmount();

      expect(vi.getTimerCount()).toBe(0);
      expect(() => press(CODE)).not.toThrow();
    });
  });

  describe("the bars", () => {
    function renderStrip(dayCount: number) {
      const component = componentOf(operationalStatusDocument, "website");

      renderWithProviders(
        <Switched>
          <HistoryStrip
            component={component}
            incidents={[]}
            generatedAt={operationalStatusDocument.generatedAt}
            checksBegan={component.days[0]?.date ?? ""}
            dayCount={dayCount}
            describedBy=""
          />
        </Switched>,
      );

      return within(screen.getByRole("group")).getAllByRole("img", { hidden: true });
    }

    it("fall one after another along the 30 days a narrow viewport shows", () => {
      const bars = renderStrip(30);

      press(CODE);

      expect(bars[0]).toHaveClass("animate-domino-fall");
      expect(bars[0]).toHaveStyle({ animationDelay: "0ms" });
      expect(bars[1]).toHaveStyle({ animationDelay: "77ms" });
      expect(bars[28]).toHaveClass("animate-domino-fall");
      expect(bars[29]).toHaveClass("animate-domino-fall-flat");
      expect(bars[29]).toHaveStyle({ animationDelay: "2225ms" });
    });

    it("stand up from the last of the visible days", () => {
      const bars = renderStrip(30);
      press(CODE);

      wait(RISE_AT_MS);

      expect(bars[29]).toHaveClass("animate-domino-rise-flat");
      expect(bars[29]).toHaveStyle({ animationDelay: "0ms" });
      expect(bars[0]).toHaveClass("animate-domino-rise");
      expect(bars[0]).toHaveStyle({ animationDelay: "1068ms" });
    });

    it("keep the 25 ms step of the full 90 days", () => {
      const bars = renderStrip(90);

      press(CODE);

      expect(bars[1]).toHaveStyle({ animationDelay: "25ms" });
      expect(bars[89]).toHaveClass("animate-domino-fall-flat");
    });

    it("are their own layer before, during and after a run, so a run does not restyle them", () => {
      const bars = renderStrip(90);
      expect(bars[0]).toHaveClass("will-change-transform");

      press(CODE);
      expect(bars[0]).toHaveClass("will-change-transform");

      wait(DONE_AT_MS);
      expect(bars[0]).toHaveClass("will-change-transform");
    });

    it("are all upright again when the extras switch off midway through a run", () => {
      const bars = renderStrip(90);
      press(CODE);
      wait(1000);
      expect(bars[0]).toHaveClass("animate-domino-fall");

      fireEvent.click(screen.getByText("switch off"));

      for (const bar of bars) {
        expect(bar.className).not.toMatch(/animate-domino/);
        expect(bar.className).not.toMatch(/will-change/);
      }
    });
  });

  describe("dominoAnimation", () => {
    it("gives nothing while no run plays", () => {
      expect(dominoAnimation(undefined, 3, 90)).toEqual({ className: undefined, delay: undefined });
    });

    it("lets a bar stand on its neighbour's heels in the same sweep whatever the count", () => {
      expect(dominoAnimation("fall", 10, 90).delay).toBe("250ms");
      expect(dominoAnimation("fall", 29, 30).delay).toBe("2225ms");
      expect(dominoAnimation("rise", 29, 30).delay).toBe("0ms");
      expect(dominoAnimation("rise", 0, 30).delay).toBe("1068ms");
    });
  });
});
