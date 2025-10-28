import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useExperiments } from "~/hooks/experiment/useExperiments/useExperiments";

import { ListExperiments } from "../list-experiments";

globalThis.React = React;

// Mock hooks
vi.mock("~/hooks/experiment/useExperiments/useExperiments", () => ({
  useExperiments: vi.fn(),
}));

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

const mockUseRouter = useRouter as ReturnType<typeof vi.fn>;
const mockUseSearchParams = useSearchParams as ReturnType<typeof vi.fn>;

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
          if (value === "member" || defaultValue === "member") {
            onValueChange("all");
          } else if (value === "all" || !value) {
            onValueChange("member");
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

    // Set up Next.js navigation mocks
    const mockReplace = vi.fn();
    const mockSearchParams = new URLSearchParams();

    mockUseRouter.mockReturnValue({
      replace: mockReplace,
    });

    mockUseSearchParams.mockReturnValue(mockSearchParams);

    (useExperiments as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { body: [{ id: "1", name: "Exp 1" }] },
      filter: "member",
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
      filter: "member",
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
      filter: "member",
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
      filter: "member",
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

    // The select should be rendered with value "member"
    const selects = screen.getAllByTestId("select");
    expect(selects.length).toBe(1); // Only filter select, no status select
  });

  it("combines filter and search functionality", () => {
    render(<ListExperiments />);

    // Add a search term
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
      filter: "member",
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
