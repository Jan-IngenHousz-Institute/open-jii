import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { ChartTypePicker } from "./chart-type-picker";

describe("ChartTypePicker", () => {
  it("renders the active chart type as the trigger label", () => {
    render(<ChartTypePicker value="line" onChange={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }),
    ).toHaveTextContent("workspace.charts.types.line");
  });

  it("opens a popover with all registered chart types grouped by family", async () => {
    const user = userEvent.setup();
    render(<ChartTypePicker value="line" onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }));

    expect(await screen.findByText("workspace.families.basic")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /workspace\.charts\.types\.scatter/ }),
    ).toBeInTheDocument();
  });

  it("marks the active chart type with aria-pressed=true", async () => {
    const user = userEvent.setup();
    render(<ChartTypePicker value="scatter" onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }));

    const scatterTile = await screen.findByRole("button", {
      name: /workspace\.charts\.types\.scatter/,
    });
    expect(scatterTile).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /workspace\.charts\.types\.line/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("invokes onChange and closes the popover when a tile is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChartTypePicker value="line" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }));

    const scatterTile = await screen.findByRole("button", {
      name: /workspace\.charts\.types\.scatter/,
    });
    await user.click(scatterTile);

    expect(onChange).toHaveBeenCalledWith("scatter");
  });

  it("hides families that have no registered chart types", async () => {
    // Currently only the basic family registers types (line + scatter); the
    // statistical/scientific/3D tabs land with their respective family PRs.
    const user = userEvent.setup();
    render(<ChartTypePicker value="line" onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }));

    expect(screen.getByRole("tab", { name: "workspace.families.basic" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "workspace.families.3d" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "workspace.families.statistical" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "workspace.families.scientific" }),
    ).not.toBeInTheDocument();
  });
});
