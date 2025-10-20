import "@testing-library/jest-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Macro } from "@repo/api";

import { MacroSearchPopover } from "../macro-search-popover";

globalThis.React = React;

// --------------------
// Mocks
// --------------------
vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => "en-US",
}));

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) =>
      ({
        "experiments.searchMacros": "Search macros…",
        "experiments.addMacro": "Add macro",
        "experiments.seeMacroDetails": "See macro details",
        "experiments.searchingMacros": "Searching macros…",
        "experiments.noMacrosFound": "No macros found",
        "experiments.tryDifferentSearchMacros": "Try a different search term",
        "experiments.noMacrosAvailable": "No macros available",
        "experiments.createFirstMacro": "Create your first macro",
      })[k] ?? k,
  }),
}));

vi.mock("@repo/ui/components", () => {
  const Button = ({
    children,
    onClick,
    disabled,
    title,
    "aria-label": ariaLabel,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    "aria-label"?: string;
    variant?: string;
    size?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} title={title} aria-label={ariaLabel} {...rest}>
      {children}
    </button>
  );

  const Command = ({
    children,
    shouldFilter,
  }: React.PropsWithChildren & { shouldFilter?: boolean }) => (
    <div data-testid="command" data-should-filter={shouldFilter}>
      {children}
    </div>
  );

  const CommandEmpty = ({ children }: React.PropsWithChildren) => (
    <div data-testid="command-empty">{children}</div>
  );

  const CommandGroup = ({ children }: React.PropsWithChildren) => (
    <div data-testid="command-group">{children}</div>
  );

  const CommandInput = ({
    placeholder,
    value,
    onValueChange,
    ...rest
  }: React.InputHTMLAttributes<HTMLInputElement> & {
    onValueChange?: (value: string) => void;
  }) => (
    <input
      data-testid="command-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      {...rest}
    />
  );

  const CommandItem = ({
    children,
    value,
    className,
  }: React.PropsWithChildren & { value?: string; className?: string }) => (
    <div data-testid="command-item" data-value={value} className={className}>
      {children}
    </div>
  );

  const CommandList = ({ children }: React.PropsWithChildren) => (
    <div data-testid="command-list">{children}</div>
  );

  const PopoverContent = ({
    children,
    className,
    align,
  }: React.PropsWithChildren & { className?: string; align?: string }) => (
    <div data-testid="popover-content" className={className} data-align={align}>
      {children}
    </div>
  );

  return {
    Button,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    PopoverContent,
  };
});

vi.mock("lucide-react", () => ({
  SearchX: ({ className }: { className?: string }) => (
    <span data-testid="search-x-icon" className={className} />
  ),
  PlusSquare: ({ className }: { className?: string }) => (
    <span data-testid="plus-square-icon" className={className} />
  ),
  ExternalLink: ({ className }: { className?: string }) => (
    <span data-testid="external-link-icon" className={className} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    target,
    rel,
    title,
    "aria-label": ariaLabel,
    className,
  }: React.PropsWithChildren & {
    href: string;
    target?: string;
    rel?: string;
    title?: string;
    "aria-label"?: string;
    className?: string;
  }) => (
    <a
      data-testid="link"
      href={href}
      target={target}
      rel={rel}
      title={title}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </a>
  ),
}));

// --------------------
// Test data & helpers
// --------------------
const macros: Macro[] = [
  {
    id: "m1",
    name: "Plot Temperature",
    description: "Visualize temperature data",
    language: "python",
    createdBy: "user1",
    createdAt: "2025-09-04T00:00:00Z",
    updatedAt: "2025-09-04T00:00:00Z",
    createdByName: "Ada Lovelace",
  } as Macro,
  {
    id: "m2",
    name: "Plot Humidity",
    description: "Visualize humidity data",
    language: "r",
    createdBy: "user2",
    createdAt: "2025-09-04T00:00:00Z",
    updatedAt: "2025-09-04T00:00:00Z",
    createdByName: "Al Turing",
  } as Macro,
  {
    id: "m3",
    name: "Statistical Analysis",
    description: "Perform statistical analysis",
    language: "javascript",
    createdBy: "user3",
    createdAt: "2025-09-04T00:00:00Z",
    updatedAt: "2025-09-04T00:00:00Z",
  } as Macro,
];

function renderPopover(over: Partial<React.ComponentProps<typeof MacroSearchPopover>> = {}) {
  const props: React.ComponentProps<typeof MacroSearchPopover> = {
    availableMacros: macros,
    searchValue: "",
    onSearchChange: vi.fn(),
    onAddMacro: vi.fn(),
    isAddingMacro: false,
    loading: false,
    setOpen: vi.fn(),
    ...over,
  };
  return {
    ...render(<MacroSearchPopover {...props} />),
    props,
  };
}

// --------------------
// Tests
// --------------------
describe("<MacroSearchPopover />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with correct structure and shouldFilter=false", () => {
    renderPopover();

    expect(screen.getByTestId("popover-content")).toBeInTheDocument();
    expect(screen.getByTestId("command")).toHaveAttribute("data-should-filter", "false");
    expect(screen.getByTestId("command-input")).toBeInTheDocument();
    expect(screen.getByTestId("command-list")).toBeInTheDocument();
    expect(screen.getByTestId("command-group")).toBeInTheDocument();
  });

  it("displays search input with correct placeholder", () => {
    renderPopover();

    const input = screen.getByTestId("command-input");
    expect(input).toHaveAttribute("placeholder", "Search macros…");
  });

  it("renders all available macros as command items", () => {
    renderPopover();

    const items = screen.getAllByTestId("command-item");
    expect(items).toHaveLength(3);

    // Check macro names
    expect(screen.getByText("Plot Temperature")).toBeInTheDocument();
    expect(screen.getByText("Plot Humidity")).toBeInTheDocument();
    expect(screen.getByText("Statistical Analysis")).toBeInTheDocument();

    // Check languages
    expect(screen.getByText("python")).toBeInTheDocument();
    expect(screen.getByText("r")).toBeInTheDocument();
    expect(screen.getByText("javascript")).toBeInTheDocument();
  });

  it("displays macro details correctly with created by info", () => {
    renderPopover();

    // Check that created by info is shown for macros that have it
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Al Turing")).toBeInTheDocument();

    // Check that language labels are shown
    const languageLabels = screen.getAllByText("Language:");
    expect(languageLabels).toHaveLength(3);

    // Check that created by labels are shown for macros that have creator
    const createdByLabels = screen.getAllByText("Created by:");
    expect(createdByLabels).toHaveLength(2); // Only m1 and m2 have createdByName
  });

  it("renders add buttons for all macros", () => {
    renderPopover();

    const addButtons = screen.getAllByLabelText("Add macro");
    expect(addButtons).toHaveLength(3);

    addButtons.forEach((button) => {
      expect(button).toHaveAttribute("title", "Add macro");
    });

    // Check that plus icons are present (there should be 3)
    expect(screen.getAllByTestId("plus-square-icon")).toHaveLength(3);
  });

  it("renders external links for all macros", () => {
    renderPopover();

    const links = screen.getAllByTestId("link");
    expect(links).toHaveLength(3);

    expect(links[0]).toHaveAttribute("href", "/en-US/platform/macros/m1");
    expect(links[1]).toHaveAttribute("href", "/en-US/platform/macros/m2");
    expect(links[2]).toHaveAttribute("href", "/en-US/platform/macros/m3");

    links.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAttribute("title", "See macro details");
      expect(link).toHaveAttribute("aria-label", "See macro details");
    });
  });

  it("calls onAddMacro when add button is clicked", async () => {
    const onAddMacro = vi.fn();
    const setOpen = vi.fn();
    const onSearchChange = vi.fn();
    renderPopover({ onAddMacro, setOpen, onSearchChange });

    const addButtons = screen.getAllByLabelText("Add macro");
    await userEvent.click(addButtons[0]);

    expect(onAddMacro).toHaveBeenCalledWith("m1");
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("handles async onAddMacro correctly", async () => {
    const onAddMacro = vi.fn().mockResolvedValue(undefined);
    const setOpen = vi.fn();
    const onSearchChange = vi.fn();
    renderPopover({ onAddMacro, setOpen, onSearchChange });

    const addButtons = screen.getAllByLabelText("Add macro");
    await userEvent.click(addButtons[1]);

    await waitFor(() => {
      expect(onAddMacro).toHaveBeenCalledWith("m2");
      expect(setOpen).toHaveBeenCalledWith(false);
      expect(onSearchChange).toHaveBeenCalledWith("");
    });
  });

  it("disables add buttons when isAddingMacro is true", () => {
    renderPopover({ isAddingMacro: true });

    const addButtons = screen.getAllByLabelText("Add macro");
    addButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it("shows loading state", () => {
    renderPopover({ loading: true, availableMacros: [] });

    expect(screen.getByText("Searching macros…")).toBeInTheDocument();
  });

  it("shows no macros found message when search has no results", () => {
    renderPopover({
      availableMacros: [],
      searchValue: "nonexistent",
      loading: false,
    });

    expect(screen.getByText("No macros found")).toBeInTheDocument();
    expect(screen.getByText("Try a different search term")).toBeInTheDocument();
    expect(screen.getByTestId("search-x-icon")).toBeInTheDocument();
  });

  it("shows no macros available message when no search and no macros", () => {
    renderPopover({
      availableMacros: [],
      searchValue: "",
      loading: false,
    });

    expect(screen.getByText("No macros available")).toBeInTheDocument();
    expect(screen.getByText("Create your first macro")).toBeInTheDocument();
  });

  it("forwards search value and onSearchChange to input", () => {
    const onSearchChange = vi.fn();
    renderPopover({ searchValue: "test", onSearchChange });

    const input = screen.getByTestId("command-input");
    expect(input).toHaveValue("test");

    // Test the callback forwarding by triggering onChange event
    // Our mock CommandInput calls onValueChange when onChange fires
    fireEvent.change(input, { target: { value: "new search" } });

    expect(onSearchChange).toHaveBeenCalledWith("new search");
  });

  it("uses custom popoverClassName when provided", () => {
    renderPopover({ popoverClassName: "w-96" });

    const popoverContent = screen.getByTestId("popover-content");
    expect(popoverContent).toHaveClass("w-96");
  });

  it("uses default popoverClassName when not provided", () => {
    renderPopover();

    const popoverContent = screen.getByTestId("popover-content");
    expect(popoverContent).toHaveClass("w-80");
  });

  it("sets correct data-value attributes on command items", () => {
    renderPopover();

    const items = screen.getAllByTestId("command-item");
    expect(items[0]).toHaveAttribute("data-value", "m1");
    expect(items[1]).toHaveAttribute("data-value", "m2");
    expect(items[2]).toHaveAttribute("data-value", "m3");
  });

  it("calls onAddMacro when add button is clicked (basic functionality)", async () => {
    const onAddMacro = vi.fn();
    renderPopover({ onAddMacro });

    const addButtons = screen.getAllByLabelText("Add macro");
    await userEvent.click(addButtons[0]);

    expect(onAddMacro).toHaveBeenCalledWith("m1");
  });
});
