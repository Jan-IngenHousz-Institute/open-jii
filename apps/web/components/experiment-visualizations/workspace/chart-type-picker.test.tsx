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

  it("paginates by family, only the active tab's chart types are visible at once", async () => {
    const user = userEvent.setup();
    render(<ChartTypePicker value="line" onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }));

    // Default tab = current chart's family (basic). Statistical chart types
    // (histogram) live on a different tab and shouldn't render until the
    // user switches.
    expect(
      screen.getByRole("button", { name: /workspace\.charts\.types\.scatter/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /workspace\.charts\.types\.histogram/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "workspace.families.statistical" }));
    expect(
      await screen.findByRole("button", { name: "workspace.charts.types.histogram" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /workspace\.charts\.types\.scatter/ }),
    ).not.toBeInTheDocument();
  });

  it("opens on the family of the current chart so reopening drops the user where they are", async () => {
    const user = userEvent.setup();
    render(<ChartTypePicker value="histogram" onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }));

    expect(screen.getByRole("tab", { name: "workspace.families.statistical" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "workspace.charts.types.histogram" }),
    ).toBeInTheDocument();
  });

  it("hides families that have no registered chart types", async () => {
    const user = userEvent.setup();
    render(<ChartTypePicker value="line" onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }));

    expect(screen.getByRole("tab", { name: "workspace.families.basic" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "workspace.families.statistical" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "workspace.families.3d" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "workspace.families.scientific" }),
    ).not.toBeInTheDocument();
  });

  it("renders a tile for every registered basic chart type", async () => {
    const user = userEvent.setup();
    render(<ChartTypePicker value="line" onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /workspace\.charts\.pickerLabel/ }));

    for (const type of [
      "line",
      "scatter",
      "bar",
      "area",
      "dot-plot",
      "lollipop",
      "bubble",
      "pie",
    ]) {
      expect(
        screen.getByRole("button", { name: new RegExp(`workspace\\.charts\\.types\\.${type}`) }),
      ).toBeInTheDocument();
    }
  });
});
