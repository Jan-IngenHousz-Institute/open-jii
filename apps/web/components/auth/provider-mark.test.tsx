import { render } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ProviderMark } from "./provider-mark";

describe("<ProviderMark />", () => {
  it("draws ORCID's icon with white letters on the green disc", () => {
    const { container } = render(<ProviderMark id="orcid" size={20} />);
    const svg = container.querySelector("svg");

    expect(svg).toHaveAttribute("width", "20");
    expect(svg?.querySelector('path[fill="#A6CE39"]')).toBeInTheDocument();
    expect(svg?.querySelector('g[fill="#FFFFFF"]')).toBeInTheDocument();
  });
});
