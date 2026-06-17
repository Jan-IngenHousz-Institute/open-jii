import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ScaledFrame } from "./scaled-frame";

describe("ScaledFrame", () => {
  it("renders children inside the frame", () => {
    render(
      <ScaledFrame innerHeight={800} scale={0.5} width={1280}>
        <span data-testid="child">inner</span>
      </ScaledFrame>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("keeps children in the DOM when hidden (lets parents fade without unmount)", () => {
    render(
      <ScaledFrame innerHeight={400} scale={1} width={1280} hidden>
        <span data-testid="child">inner</span>
      </ScaledFrame>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
