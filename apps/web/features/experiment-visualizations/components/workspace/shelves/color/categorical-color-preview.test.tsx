import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { CATEGORY_PALETTE } from "../../../charts/colors/palettes";
import { CategoricalColorPreview } from "./categorical-color-preview";

describe("CategoricalColorPreview", () => {
  it("renders the preview label and helper copy via i18n keys", () => {
    render(<CategoricalColorPreview />);
    expect(screen.getByText("workspace.shelves.preview")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.colorModeCategoricalHelp")).toBeInTheDocument();
  });

  it("renders up to 12 swatches from the categorical palette", () => {
    const { container } = render(<CategoricalColorPreview />);
    const swatches = container.querySelectorAll("div.rounded-sm");
    expect(swatches.length).toBe(Math.min(12, CATEGORY_PALETTE.length));
  });

  it("uses palette colors as inline backgrounds", () => {
    const { container } = render(<CategoricalColorPreview />);
    const swatches = Array.from(container.querySelectorAll("div.rounded-sm"));
    const firstColor = CATEGORY_PALETTE[0];
    expect(swatches[0]).toHaveStyle({ background: firstColor });
  });
});
