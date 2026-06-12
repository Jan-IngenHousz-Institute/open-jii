import { render } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ColorscaleSwatch } from "./colorscale-swatch";

describe("ColorscaleSwatch", () => {
  it("renders a div with the gradient applied to background", () => {
    const gradient = "linear-gradient(to right, red, blue)";
    const { container } = render(<ColorscaleSwatch gradient={gradient} />);
    const swatch = container.firstChild;
    expect(swatch).toHaveStyle({ background: gradient });
  });

  it("applies the default size classes", () => {
    const { container } = render(<ColorscaleSwatch gradient="red" />);
    const swatch = container.firstChild as HTMLElement;
    expect(swatch.className).toMatch(/h-4/);
    expect(swatch.className).toMatch(/w-8/);
  });

  it("merges in custom className overrides", () => {
    const { container } = render(<ColorscaleSwatch gradient="red" className="h-5 w-full" />);
    const swatch = container.firstChild as HTMLElement;
    expect(swatch.className).toMatch(/h-5/);
    expect(swatch.className).toMatch(/w-full/);
  });
});
