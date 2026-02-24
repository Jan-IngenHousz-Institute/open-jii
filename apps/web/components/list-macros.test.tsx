import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useMacros } from "~/hooks/macro/useMacros/useMacros";
import type { MacroFilter } from "~/hooks/macro/useMacros/useMacros";

import { ListMacros } from "./list-macros";

const mockUseMacros = vi.fn();

// Mock the translation hook
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("~/components/macro-overview-cards", () => ({
  MacroOverviewCards: (props: { macros?: unknown[]; isLoading: boolean }) => (
    <div data-testid="macro-cards" data-loading={props.isLoading}>
      {props.macros?.length ?? 0} macros
    </div>
  ),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange: (value: string) => void;
  }) => (
    <select
      value={value}
      onChange={(e) => onValueChange((e.target as HTMLSelectElement).value)}
      data-testid={`select-${value}`}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
  Input: ({
    placeholder,
    value,
    onChange,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      data-testid="search-input"
      {...props}
    />
  ),
}));

describe("ListMacros", () => {
  const mockSetFilter = vi.fn();
  const mockSetSearch = vi.fn();
  const mockSetLanguage = vi.fn();

  const mockMacros = [
    {
      id: "macro-1",
      name: "Python Analysis",
      description: "A Python macro",
      language: "python" as const,
      code: "python_analysis.py",
      filename: "python_analysis.py",
      sortOrder: null,
      createdBy: "user-1",
      createdByName: "User 1",
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
    },
    {
      id: "macro-2",
      name: "R Statistics",
      description: "An R macro",
      language: "r" as const,
      code: "r_statistics.r",
      filename: "r_statistics.r",
      sortOrder: null,
      createdBy: "user-2",
      createdByName: "User 2",
      createdAt: "2023-01-02T00:00:00Z",
      updatedAt: "2023-01-02T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMacros.mockReturnValue({
      data: mockMacros,
      isLoading: false,
      error: null,
      filter: "my" as MacroFilter,
      setFilter: mockSetFilter,
      search: "",
      setSearch: mockSetSearch,
      language: undefined,
      setLanguage: mockSetLanguage,
    });
  });

  it("should render search input and filters", () => {
    render(<ListMacros />);

    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("should call useMacros with empty object", () => {
    render(<ListMacros />);

    expect(mockUseMacros).toHaveBeenCalledWith({});
  });

  it("should call setSearch when typing in search input", async () => {
    const user = userEvent.setup();
    render(<ListMacros />);
    const searchInput = screen.getByTestId("search-input");

    await user.type(searchInput, "p");

    expect(mockSetSearch).toHaveBeenCalled();
  });

  it("should pass loading state to MacroOverviewCards", () => {
    mockUseMacros.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      filter: "my" as MacroFilter,
      setFilter: mockSetFilter,
      search: "",
      setSearch: mockSetSearch,
      language: undefined,
      setLanguage: mockSetLanguage,
    });

    render(<ListMacros />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should pass macro data to MacroOverviewCards", () => {
    render(<ListMacros />);

    expect(screen.getByText("2 macros")).toBeInTheDocument();
  });

  it("should render with correct placeholder text", () => {
    render(<ListMacros />);

    expect(screen.getByPlaceholderText("macros.searchPlaceholder")).toBeInTheDocument();
  });

  it("should show clear button when search has value", () => {
    mockUseMacros.mockReturnValue({
      data: mockMacros,
      isLoading: false,
      error: null,
      filter: "my" as MacroFilter,
      setFilter: mockSetFilter,
      search: "test",
      setSearch: mockSetSearch,
      language: undefined,
      setLanguage: mockSetLanguage,
    });

    render(<ListMacros />);

    const clearButton = screen.getByRole("button", { name: "macros.clearSearch" });
    expect(clearButton).toBeInTheDocument();
  });

  it("should clear search when clear button is clicked", async () => {
    const user = userEvent.setup();
    mockUseMacros.mockReturnValue({
      data: mockMacros,
      isLoading: false,
      error: null,
      filter: "my" as MacroFilter,
      setFilter: mockSetFilter,
      search: "test",
      setSearch: mockSetSearch,
      language: undefined,
      setLanguage: mockSetLanguage,
    });

    render(<ListMacros />);

    const clearButton = screen.getByRole("button", { name: "macros.clearSearch" });
    await user.click(clearButton);

    expect(mockSetSearch).toHaveBeenCalledWith("");
  });
});
