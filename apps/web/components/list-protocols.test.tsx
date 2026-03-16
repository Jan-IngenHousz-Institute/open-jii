import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useProtocols } from "~/hooks/protocol/useProtocols/useProtocols";
import type { ProtocolFilter } from "~/hooks/protocol/useProtocols/useProtocols";

import { ListProtocols } from "./list-protocols";

// Mock the hooks
vi.mock("~/hooks/protocol/useProtocols/useProtocols");
const mockUseProtocols = vi.mocked(useProtocols);

// Mock the translation hook
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the ProtocolOverviewCards component
vi.mock("./protocol-overview-cards", () => ({
  ProtocolOverviewCards: ({ protocols }: { protocols: Record<string, unknown>[] | undefined }) => (
    <div data-testid="protocol-overview-cards">
      {protocols === undefined ? "Loading..." : `${protocols.length} protocols`}
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

describe("ListProtocols", () => {
  const mockSetFilter = vi.fn();
  const mockSetSearch = vi.fn();

  const mockProtocols = [
    {
      id: "protocol-1",
      name: "MultispeQ Protocol",
      description: "A multispeq protocol",
      code: [{}],
      family: "multispeq" as const,
      sortOrder: null,
      createdBy: "user-1",
      createdByName: "User 1",
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
    },
    {
      id: "protocol-2",
      name: "Ambit Protocol",
      description: "An ambit protocol",
      code: [{}],
      family: "ambit" as const,
      sortOrder: 1,
      createdBy: "user-2",
      createdByName: "User 2",
      createdAt: "2023-01-02T00:00:00Z",
      updatedAt: "2023-01-02T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProtocols.mockReturnValue({
      protocols: mockProtocols,
      filter: "my" as ProtocolFilter,
      setFilter: mockSetFilter,
      search: "",
      setSearch: mockSetSearch,
    });
  });

  it("should render search input and filters", () => {
    render(<ListProtocols />);

    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("should call useProtocols with empty object", () => {
    render(<ListProtocols />);

    expect(mockUseProtocols).toHaveBeenCalledWith({});
  });

  it("should call setSearch when typing in search input", async () => {
    const user = userEvent.setup();
    render(<ListProtocols />);
    const searchInput = screen.getByTestId("search-input");

    await user.type(searchInput, "p");

    expect(mockSetSearch).toHaveBeenCalled();
  });

  it("should render loading state when protocols are undefined", () => {
    mockUseProtocols.mockReturnValue({
      protocols: undefined,
      filter: "my" as ProtocolFilter,
      setFilter: mockSetFilter,
      search: "",
      setSearch: mockSetSearch,
    });

    render(<ListProtocols />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should pass protocol data to ProtocolOverviewCards", () => {
    render(<ListProtocols />);

    expect(screen.getByText("2 protocols")).toBeInTheDocument();
  });

  it("should render with correct placeholder text", () => {
    render(<ListProtocols />);

    expect(screen.getByPlaceholderText("protocols.searchProtocols")).toBeInTheDocument();
  });

  it("should show clear button when search has value", () => {
    mockUseProtocols.mockReturnValue({
      protocols: mockProtocols,
      filter: "my" as ProtocolFilter,
      setFilter: mockSetFilter,
      search: "test",
      setSearch: mockSetSearch,
    });

    render(<ListProtocols />);

    const clearButton = screen.getByRole("button", { name: "protocols.clearSearch" });
    expect(clearButton).toBeInTheDocument();
  });

  it("should not show clear button when search is empty", () => {
    render(<ListProtocols />);

    const clearButton = screen.queryByRole("button", { name: "protocols.clearSearch" });
    expect(clearButton).not.toBeInTheDocument();
  });

  it("should clear search when clear button is clicked", async () => {
    const user = userEvent.setup();
    mockUseProtocols.mockReturnValue({
      protocols: mockProtocols,
      filter: "my" as ProtocolFilter,
      setFilter: mockSetFilter,
      search: "test",
      setSearch: mockSetSearch,
    });

    render(<ListProtocols />);

    const clearButton = screen.getByRole("button", { name: "protocols.clearSearch" });
    await user.click(clearButton);

    expect(mockSetSearch).toHaveBeenCalledWith("");
  });

  it("should render the filter select with correct options", () => {
    render(<ListProtocols />);

    expect(screen.getByText("protocols.filterMy")).toBeInTheDocument();
    expect(screen.getByText("protocols.filterAll")).toBeInTheDocument();
  });

  it("should render ProtocolOverviewCards component", () => {
    render(<ListProtocols />);

    expect(screen.getByTestId("protocol-overview-cards")).toBeInTheDocument();
  });

  it("should render with empty protocols list", () => {
    mockUseProtocols.mockReturnValue({
      protocols: [],
      filter: "my" as ProtocolFilter,
      setFilter: mockSetFilter,
      search: "",
      setSearch: mockSetSearch,
    });

    render(<ListProtocols />);

    expect(screen.getByText("0 protocols")).toBeInTheDocument();
  });
});
