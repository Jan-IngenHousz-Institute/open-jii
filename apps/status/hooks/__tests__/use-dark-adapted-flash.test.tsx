import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOW, stubReducedMotion } from "~/test/render-status";

import { ThemeProvider, useTheme } from "@repo/ui/components/theme";

import { useDarkAdaptedFlash } from "../use-dark-adapted-flash";

const MINUTE_MS = 60_000;

function Harness() {
  const leaf = useRef<SVGSVGElement>(null);
  const { setTheme } = useTheme();
  useDarkAdaptedFlash(leaf);

  return (
    <>
      <svg ref={leaf} />
      <button onClick={() => setTheme("dark")}>dark</button>
      <button onClick={() => setTheme("light")}>light</button>
    </>
  );
}

function sitInDarkFor(minutes: number) {
  fireEvent.click(screen.getByText("dark"));
  vi.setSystemTime(NOW + minutes * MINUTE_MS);
  fireEvent.click(screen.getByText("light"));
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <Harness />
    </ThemeProvider>,
  );
});

describe("useDarkAdaptedFlash", () => {
  it("flashes the leaf when the page goes light after 20 minutes in the dark", () => {
    const animate = vi.spyOn(Element.prototype, "animate");

    sitInDarkFor(20);

    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledWith(expect.any(Array), { duration: 3600 });
  });

  it("stays still when the dark spell was shorter", () => {
    const animate = vi.spyOn(Element.prototype, "animate");

    sitInDarkFor(19);

    expect(animate).not.toHaveBeenCalled();
  });

  it("stays still under reduced motion", () => {
    stubReducedMotion(true);
    const animate = vi.spyOn(Element.prototype, "animate");

    sitInDarkFor(30);

    expect(animate).not.toHaveBeenCalled();
  });
});
