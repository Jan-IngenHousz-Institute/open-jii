import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useExperiments } from "~/hooks/experiment/useExperiments/useExperiments";

import { ListExperiments } from "../list-experiments";

globalThis.React = React;

// Mock hooks
vi.mock("~/hooks/experiment/useExperiments/useExperiments", () => ({
  useExperiments: vi.fn(),
}));

// Mock translation
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock components
vi.mock("~/components/experiment-overview-cards", () => ({
  ExperimentOverviewCards: ({ experiments }: { experiments?: unknown[] }) => (
    <div data-testid="experiment-cards">{JSON.stringify(experiments)}</div>
  ),
}));

// Mock the Select components
vi.mock("@repo/ui/components", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    defaultValue,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange: (value: string) => void;
    defaultValue?: string;
  }) => (
    <div data-testid="select" data-value={value ?? defaultValue}>
      {children}
      <button
        data-testid="select-trigger"
        onClick={() => {
          // Simulate selecting different values based on the current value
          if (value === "my" || defaultValue === "my") {
            onValueChange("member");
          } else if (value === "all" || !value) {
            onValueChange("draft");
          }
        }}
      >
        {value ?? defaultValue}
      </button>
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <div data-testid="select-item" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-trigger">{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder: string }) => <span>{placeholder}</span>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

describe("ListExperiments", () => {
  const mockSetFilter = vi.fn();
  const mockSetStatus = vi.fn();
  const mockSetSearch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useExperiments as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { body: [{ id: "1", name: "Exp 1" }] },
      filter: "my",
      setFilter: mockSetFilter,
      status: undefined,
      setStatus: mockSetStatus,
      search: "",
      setSearch: mockSetSearch,
    });
  });

  it("renders experiments", () => {
    render(<ListExperiments />);
    expect(screen.getByTestId("experiment-cards")).toHaveTextContent("Exp 1");
  });

  it("renders empty state when no experiments", () => {
    (useExperiments as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { body: [] },
      filter: "my",
      setFilter: mockSetFilter,
      status: undefined,
      setStatus: mockSetStatus,
      search: "",
      setSearch: mockSetSearch,
    });

    render(<ListExperiments />);
    expect(screen.getByTestId("experiment-cards")).toHaveTextContent("[]");
  });

  it("renders loading state when data is undefined", () => {
    (useExperiments as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      filter: "my",
      setFilter: mockSetFilter,
      status: undefined,
      setStatus: mockSetStatus,
      search: "",
      setSearch: mockSetSearch,
    });

    render(<ListExperiments />);
    // When data is undefined, experiments prop will be undefined, which JSON.stringify converts to empty
    expect(screen.getByTestId("experiment-cards")).toBeInTheDocument();
  });

  it("updates search input and clears it", () => {
    render(<ListExperiments />);
    const input = screen.getByPlaceholderText("experiments.searchExperiments");

    fireEvent.change(input, { target: { value: "abc" } });
    expect(mockSetSearch).toHaveBeenCalledWith("abc");

    // simulate search not empty
    (useExperiments as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { body: [] },
      filter: "my",
      setFilter: mockSetFilter,
      status: undefined,
      setStatus: mockSetStatus,
      search: "abc",
      setSearch: mockSetSearch,
    });

    render(<ListExperiments />);
    fireEvent.click(screen.getByRole("button", { name: "experiments.clearSearch" }));
    expect(mockSetSearch).toHaveBeenCalledWith("");
  });

  it("changes filter via select", () => {
    render(<ListExperiments />);

    // Find the filter select (first select)
    const filterSelects = screen.getAllByTestId("select");
    const filterSelect = filterSelects[0];

    // Find the button inside the filter select and click it
    const button = filterSelect.querySelector("button");
    if (button) {
      fireEvent.click(button);
      expect(mockSetFilter).toHaveBeenCalledWith("member");
    } else {
      throw new Error("Filter select button not found");
    }
  });

  it("changes status via select", () => {
    render(<ListExperiments />);

    // Find the status select (second select)
    const statusSelects = screen.getAllByTestId("select");
    const statusSelect = statusSelects[1];

    // Find the button inside the status select and click it
    const button = statusSelect.querySelector("button");
    if (button) {
      fireEvent.click(button);
      expect(mockSetStatus).toHaveBeenCalledWith("draft");
    } else {
      throw new Error("Status select button not found");
    }
  });

  it("combines filter and search functionality", () => {
    render(<ListExperiments />);

    // First change the filter
    const filterSelect = screen.getAllByTestId("select")[0];
    const filterButton = filterSelect.querySelector("button");
    if (filterButton) {
      fireEvent.click(filterButton);
      expect(mockSetFilter).toHaveBeenCalledWith("member");
    }

    // Then add a search term
    const input = screen.getByPlaceholderText("experiments.searchExperiments");
    fireEvent.change(input, { target: { value: "test search" } });
    expect(mockSetSearch).toHaveBeenCalledWith("test search");
  });

  it("has proper accessibility attributes", () => {
    render(<ListExperiments />);

    // Check search input has proper labeling
    const searchInput = screen.getByPlaceholderText("experiments.searchExperiments");
    expect(searchInput).toHaveAttribute("type", "text");

    // Check clear button has aria-label
    const searchWithValue = "test";
    (useExperiments as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { body: [] },
      filter: "my",
      setFilter: mockSetFilter,
      status: undefined,
      setStatus: mockSetStatus,
      search: searchWithValue,
      setSearch: mockSetSearch,
    });

    render(<ListExperiments />);
    const clearButton = screen.getByRole("button", { name: "experiments.clearSearch" });
    expect(clearButton).toHaveAttribute("aria-label", "experiments.clearSearch");
  });
});
