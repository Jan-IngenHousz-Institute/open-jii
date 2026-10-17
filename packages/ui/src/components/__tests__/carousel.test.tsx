import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselRotationToggle,
} from "../carousel";

const SLIDES = ["First", "Second", "Third"];

function OneAtATime({ rotateEvery }: { rotateEvery?: number }) {
  const renderSlide = (name: string, index: number) => (
    <CarouselItem key={name} index={index} aria-label={name}>
      {name}
    </CarouselItem>
  );

  return (
    <Carousel rotateEvery={rotateEvery} aria-label="Figures">
      <CarouselContent data-testid="slides">{SLIDES.map(renderSlide)}</CarouselContent>
      <CarouselDots labels={SLIDES.map((name) => `Show ${name}`)} />
      <CarouselRotationToggle pauseLabel="Pause" resumeLabel="Resume" />
    </Carousel>
  );
}

describe("Carousel", () => {
  // Embla watches its slides with an IntersectionObserver, which jsdom lacks.
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps slides out of view from screen readers and Tab", () => {
    render(<OneAtATime />);

    const slides = screen.getAllByRole("group", { hidden: true });
    expect(slides[0]).not.toHaveAttribute("aria-hidden");
    expect(slides[1]).toHaveAttribute("aria-hidden", "true");
    expect(slides[1]).toHaveAttribute("inert");
    expect(screen.getAllByRole("group")).toHaveLength(1);
  });

  it("offers a dot per slide, marking the one in view", () => {
    render(<OneAtATime />);

    const dots = screen.getAllByRole("button", { name: /^Show / });
    expect(dots).toHaveLength(3);
    expect(dots[0]).toHaveAttribute("aria-current", "true");
    expect(dots[1]).toHaveAttribute("aria-current", "false");
  });

  it("has no toggle and no live region when it does not rotate", () => {
    render(<OneAtATime />);

    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    expect(screen.getByTestId("slides")).not.toHaveAttribute("aria-live");
  });

  it("lets the reader pause a rotating carousel, which then announces its slides", () => {
    render(<OneAtATime rotateEvery={6000} />);

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByTestId("slides")).toHaveAttribute("aria-live", "polite");
  });
});
