import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AnalysisPanel } from "../analysis-panel";

// Keep React on global for JSX in some deps
globalThis.React = React;

// Minimal i18n mock (keeps labels predictable)
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

describe("<AnalysisPanel />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const openDropdown = async (): Promise<HTMLButtonElement> => {
    const trigger = screen.getByRole("combobox");
    await userEvent.click(trigger);
    // Popover content should show a search input
    await screen.findByPlaceholderText("analysisPanel.searchPlaceholder");
    return trigger as HTMLButtonElement;
  };

  it("renders title and opens the popover", async () => {
    render(<AnalysisPanel selectedMeasurementOption="" onChange={() => void 0} disabled={false} />);

    expect(screen.getByText("analysisPanel.title")).toBeInTheDocument();

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeEnabled();

    await openDropdown();
    expect(screen.getByPlaceholderText("analysisPanel.searchPlaceholder")).toBeInTheDocument();
  });

  it("filters options and selects one, calling onChange and closing", async () => {
    const onChange = vi.fn<(value: string) => void>();
    render(<AnalysisPanel selectedMeasurementOption="" onChange={onChange} disabled={false} />);

    await openDropdown();

    // Filter to a single option
    const search = screen.getByPlaceholderText("analysisPanel.searchPlaceholder");
    await userEvent.type(search, "humidity");

    // Expect the filtered option to be present and others (like temperature) to be absent
    expect(screen.getByRole("button", { name: /Plot Humidity/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Plot Temperature/i })).not.toBeInTheDocument();

    // Select it
    await userEvent.click(screen.getByRole("button", { name: /Plot Humidity/i }));
    expect(onChange).toHaveBeenCalledWith("plot-humidity");

    // Popover should be closed (search input disappears)
    expect(
      screen.queryByPlaceholderText("analysisPanel.searchPlaceholder"),
    ).not.toBeInTheDocument();
  });

  it("respects disabled state (no open, no changes)", async () => {
    const onChange = vi.fn<(value: string) => void>();
    render(<AnalysisPanel selectedMeasurementOption="" onChange={onChange} disabled={true} />);

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();

    // Clicking should not open the popover
    await userEvent.click(trigger);
    expect(
      screen.queryByPlaceholderText("analysisPanel.searchPlaceholder"),
    ).not.toBeInTheDocument();

    expect(onChange).not.toHaveBeenCalled();
  });
});
