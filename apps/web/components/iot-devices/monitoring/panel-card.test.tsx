import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { PanelCard } from "./panel-card";

describe("PanelCard", () => {
  it("allows intrinsically wide charts and tables to shrink inside a mobile grid", () => {
    render(
      <PanelCard title="Monitoring panel">
        <div>wide content</div>
      </PanelCard>,
    );

    const card = screen.getByText("Monitoring panel").closest(".rounded-xl");
    expect(card).toHaveClass("min-w-0");
    expect(screen.getByText("wide content").parentElement).toHaveClass("min-w-0");
  });
});
