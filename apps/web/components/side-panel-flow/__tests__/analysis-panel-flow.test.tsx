import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { http, HttpResponse } from "msw";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AnalysisPanel } from "../analysis-panel";

Element.prototype.scrollIntoView = vi.fn();

// useDebounce — pragmatic mock (timer utility)
vi.mock("@/hooks/useDebounce", () => ({
  useDebounce: (value: string, _delay: number) => [value, true],
}));

// Test data — factory provides all required Macro fields
const mockMacros = [
  createMacro({
    name: "Plot Temperature",
    description: "Visualize temperature data",
    language: "python",
    createdByName: "John Doe",
  }),
  createMacro({
    name: "Plot Humidity",
    description: "Visualize humidity data",
    language: "r",
    createdByName: "Jane Smith",
  }),
  createMacro({
    name: "Statistical Analysis",
    description: "Perform statistical analysis on data",
    language: "javascript",
    createdByName: "Bob Wilson",
  }),
];

describe("<AnalysisPanel />", () => {
  beforeEach(() => {
    // Dynamic MSW handler — filters macros based on "search" query param
    server.use(
      http.get("http://localhost:3020/api/v1/macros", ({ request }) => {
        const url = new URL(request.url);
        const search = url.searchParams.get("search");
        const filtered = search
          ? mockMacros.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
          : mockMacros;
        return HttpResponse.json(filtered);
      }),
    );
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

    // Wait for React Query to return filtered results
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Plot Humidity/i })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /Plot Temperature/i })).not.toBeInTheDocument();
    });

    // Select it - click the macro item itself
    const macroItem = screen.getByRole("option", { name: /Plot Humidity/i });
    await userEvent.click(macroItem);
    expect(onChange).toHaveBeenCalledWith(mockMacros[1].id);

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
