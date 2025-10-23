import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AnalysisPanel } from "../analysis-panel";

// Keep React on global for JSX in some deps
globalThis.React = React;

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Minimal i18n mock (keeps labels predictable)
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

// Mock useLocale hook
vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => "en-US",
}));

// Mock useDebounce hook
vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: (value: string, _delay: number) => [value, true], // Return [debouncedValue, isDebounced]
}));

// Mock data
const mockMacros = [
  {
    id: "macro-1",
    name: "Plot Temperature",
    description: "Visualize temperature data",
    language: "python",
    createdByName: "John Doe",
  },
  {
    id: "macro-2",
    name: "Plot Humidity",
    description: "Visualize humidity data",
    language: "r",
    createdByName: "Jane Smith",
  },
  {
    id: "macro-3",
    name: "Statistical Analysis",
    description: "Perform statistical analysis on data",
    language: "javascript",
    createdByName: "Bob Wilson",
  },
];

// Mock the useMacros hook
vi.mock("~/hooks/macro/useMacros/useMacros", () => ({
  useMacros: vi.fn(({ search }: { search?: string }) => {
    const filteredMacros = search
      ? mockMacros.filter((macro) => macro.name.toLowerCase().includes(search.toLowerCase()))
      : mockMacros;

    return {
      data: filteredMacros,
    };
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
    await screen.findByPlaceholderText("experiments.searchMacros");
    return trigger as HTMLButtonElement;
  };

  it("renders title and opens the popover", async () => {
    render(<AnalysisPanel selectedMacroId="" onChange={() => void 0} disabled={false} />);

    expect(screen.getByText("experiments.analysisPanelTitle")).toBeInTheDocument();

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeEnabled();

    await openDropdown();
    expect(screen.getByPlaceholderText("experiments.searchMacros")).toBeInTheDocument();
  });

  it("filters options and selects one, calling onChange and closing", async () => {
    const onChange = vi.fn<(value: string) => void>();
    render(<AnalysisPanel selectedMacroId="" onChange={onChange} disabled={false} />);

    await openDropdown();

    // Filter to a single option
    const search = screen.getByPlaceholderText("experiments.searchMacros");
    await userEvent.type(search, "humidity");

    // Wait for debounce delay
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Expect the filtered option to be present and others (like temperature) to be absent
    expect(screen.getByRole("heading", { name: /Plot Humidity/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Plot Temperature/i })).not.toBeInTheDocument();

    // Select it - click the add macro button
    await userEvent.click(screen.getByRole("button", { name: /experiments\.addMacro/i }));
    expect(onChange).toHaveBeenCalledWith("macro-2");

    // Popover should be closed (search input disappears)
    expect(screen.queryByPlaceholderText("experiments.searchMacros")).not.toBeInTheDocument();
  });

  it("respects disabled state (no open, no changes)", async () => {
    const onChange = vi.fn<(value: string) => void>();
    render(<AnalysisPanel selectedMacroId="" onChange={onChange} disabled={true} />);

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();

    // Clicking should not open the popover
    await userEvent.click(trigger);
    expect(screen.queryByPlaceholderText("experiments.searchMacros")).not.toBeInTheDocument();

    expect(onChange).not.toHaveBeenCalled();
  });
});
