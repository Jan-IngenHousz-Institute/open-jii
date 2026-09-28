import { render } from "@testing-library/react";
import { QRCodeSVG } from "qrcode.react";
import React from "react";

import { QrCode } from "../qr-code";

const VALUE = "https://openjii.org/en-US/join/KP7Q-4WMX";

/**
 * Colours and quiet zone are asserted as literals rather than against the
 * component's own constants: a test that reads the same value it is checking
 * would keep passing through exactly the change it exists to stop.
 */
function paths(container: HTMLElement) {
  const [background, foreground] = Array.from(container.querySelectorAll("svg path"));
  return { background, foreground };
}

describe("QrCode", () => {
  it("draws dark modules on a solid light field in any theme", () => {
    const { container } = render(<QrCode value={VALUE} />);
    const { background, foreground } = paths(container);

    // Scanners assume dark-on-light. `currentColor` or a transparent ground
    // inverts the code wherever the surrounding UI is dark.
    expect(background?.getAttribute("fill")).toBe("#ffffff");
    expect(foreground?.getAttribute("fill")).toBe("#18181b");
    expect(foreground?.getAttribute("fill")).not.toBe("currentColor");
    expect(container.querySelector('svg path[fill="transparent"]')).toBeNull();
    expect(container.querySelector('svg path[fill="none"]')).toBeNull();
  });

  it("surrounds the modules with a quiet zone", () => {
    const { container } = render(<QrCode value={VALUE} />);
    const svg = container.querySelector("svg");

    // viewBox counts modules. The spec's quiet zone is 4 on every side, so the
    // box has to be 8 wider than the same symbol drawn with no margin at all —
    // which is what `qrcode.react` gives you by default.
    const [, , width] = (svg?.getAttribute("viewBox") ?? "").split(" ").map(Number);
    const bare = render(<QRCodeSVG value={VALUE} level="M" marginSize={0} />).container;
    const [, , bareWidth] = (bare.querySelector("svg")?.getAttribute("viewBox") ?? "")
      .split(" ")
      .map(Number);

    expect(bareWidth).toBeGreaterThan(0);
    expect(width).toBe((bareWidth ?? 0) + 2 * 4);

    // The background path spans the whole box, quiet zone included.
    expect(paths(container).background?.getAttribute("d")).toBe(`M0,0 h${width}v${width}H0z`);
  });

  it("keeps a three-prop signature, so no call site can override the colours", () => {
    const { container } = render(<QrCode value={VALUE} size={132} className="rounded-md" />);
    const svg = container.querySelector("svg");

    expect(svg).toHaveAttribute("height", "132");
    expect(svg).toHaveAttribute("width", "132");
    expect(svg).toHaveClass("rounded-md");
    expect(paths(container).foreground?.getAttribute("fill")).toBe("#18181b");
  });

  it("encodes the value it is given", () => {
    const first = render(<QrCode value={VALUE} />);
    const second = render(<QrCode value="https://openjii.org/en-US/join/ABCD-EFGH" />);

    expect(paths(first.container).foreground?.getAttribute("d")).not.toBe(
      paths(second.container).foreground?.getAttribute("d"),
    );
  });
});
