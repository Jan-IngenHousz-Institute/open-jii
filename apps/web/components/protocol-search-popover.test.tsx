import "@testing-library/jest-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Protocol } from "@repo/api";

import { ProtocolSearchPopover } from "./protocol-search-popover";

globalThis.React = React;

// --------------------
// Mocks
// --------------------
vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => "en-US",
}));

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("@repo/ui/components", () => {
  const Badge = ({ children, className }: React.PropsWithChildren & { className?: string }) => (
    <div data-testid="badge" className={className}>
      {children}
    </div>
  );

  const Command = ({
    children,
    shouldFilter,
  }: React.PropsWithChildren & { shouldFilter?: boolean }) => (
    <div data-testid="command" data-should-filter={shouldFilter}>
      {children}
    </div>
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
    onSelect,
    disabled,
  }: React.PropsWithChildren & {
    value?: string;
    className?: string;
    onSelect?: () => void;
    disabled?: boolean;
  }) => (
    <div
      data-testid="command-item"
      data-value={value}
      className={className}
      onClick={disabled ? undefined : onSelect}
      style={{ pointerEvents: disabled ? "none" : "auto" }}
    >
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
    Badge,
    Command,
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
const protocols: Protocol[] = [
  {
    id: "p1",
    name: "Fv/FM Baseline",
    description: "Dark adaptation protocol",
    code: [{ step: 1 }],
    family: "multispeq",
    sortOrder: null,
    createdBy: "user1",
    createdAt: "2025-09-04T00:00:00Z",
    updatedAt: "2025-09-04T00:00:00Z",
    createdByName: "Ada Lovelace",
  } as Protocol,
  {
    id: "p2",
    name: "Ambient Light",
    description: "Measure ambient light",
    code: [{ step: 2 }],
    family: "ambit",
    sortOrder: null,
    createdBy: "user2",
    createdAt: "2025-09-04T00:00:00Z",
    updatedAt: "2025-09-04T00:00:00Z",
    createdByName: "Al Turing",
  } as Protocol,
  {
    id: "p3",
    name: "PAM Fluorometry",
    description: "Pulse amplitude modulation",
    code: [{ step: 3 }],
    family: "multispeq",
    sortOrder: 1,
    createdBy: "user3",
    createdAt: "2025-09-04T00:00:00Z",
    updatedAt: "2025-09-04T00:00:00Z",
  } as Protocol,
];

function renderPopover(over: Partial<React.ComponentProps<typeof ProtocolSearchPopover>> = {}) {
  const props: React.ComponentProps<typeof ProtocolSearchPopover> = {
    availableProtocols: protocols,
    searchValue: "",
    onSearchChange: vi.fn(),
    onAddProtocol: vi.fn(),
    isAddingProtocol: false,
    loading: false,
    setOpen: vi.fn(),
    ...over,
  };
  return {
    ...render(<ProtocolSearchPopover {...props} />),
    props,
  };
}

// --------------------
// Tests
// --------------------
describe("<ProtocolSearchPopover />", () => {
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
    expect(input).toHaveAttribute("placeholder", "experiments.searchProtocols");
  });

  it("renders all available protocols as command items", () => {
    renderPopover();

    const items = screen.getAllByTestId("command-item");
    expect(items).toHaveLength(3);

    // Check protocol names
    expect(screen.getByText("Fv/FM Baseline")).toBeInTheDocument();
    expect(screen.getByText("Ambient Light")).toBeInTheDocument();
    expect(screen.getByText("PAM Fluorometry")).toBeInTheDocument();

    // Check families
    expect(screen.getAllByText("multispeq")).toHaveLength(2);
    expect(screen.getByText("ambit")).toBeInTheDocument();
  });

  it("displays protocol details correctly with created by info", () => {
    renderPopover();

    // Check that created by info is shown for protocols that have it
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Al Turing")).toBeInTheDocument();

    // Check that family labels are shown
    const familyLabels = screen.getAllByText("experiments.family");
    expect(familyLabels).toHaveLength(3);

    // Check that created by labels are shown for protocols that have creator
    const createdByLabels = screen.getAllByText("experiments.createdBy");
    expect(createdByLabels).toHaveLength(2); // Only p1 and p2 have createdByName
  });

  it("renders external links for all protocols", () => {
    renderPopover();

    const links = screen.getAllByTestId("link");
    expect(links).toHaveLength(3);

    expect(links[0]).toHaveAttribute("href", "/en-US/platform/protocols/p1");
    expect(links[1]).toHaveAttribute("href", "/en-US/platform/protocols/p2");
    expect(links[2]).toHaveAttribute("href", "/en-US/platform/protocols/p3");

    links.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAttribute("title", "experiments.seeProtocolDetails");
      expect(link).toHaveAttribute("aria-label", "experiments.seeProtocolDetails");
    });
  });

  it("calls onAddProtocol when command item is clicked", async () => {
    const onAddProtocol = vi.fn();
    const setOpen = vi.fn();
    const onSearchChange = vi.fn();
    renderPopover({ onAddProtocol, setOpen, onSearchChange });

    const items = screen.getAllByTestId("command-item");
    await userEvent.click(items[0]);

    expect(onAddProtocol).toHaveBeenCalledWith("p1");
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("handles async onAddProtocol correctly", async () => {
    const onAddProtocol = vi.fn().mockResolvedValue(undefined);
    const setOpen = vi.fn();
    const onSearchChange = vi.fn();
    renderPopover({ onAddProtocol, setOpen, onSearchChange });

    const items = screen.getAllByTestId("command-item");
    await userEvent.click(items[1]);

    await waitFor(() => {
      expect(onAddProtocol).toHaveBeenCalledWith("p2");
      expect(setOpen).toHaveBeenCalledWith(false);
      expect(onSearchChange).toHaveBeenCalledWith("");
    });
  });

  it("disables command items when isAddingProtocol is true", () => {
    const onAddProtocol = vi.fn();
    renderPopover({ isAddingProtocol: true, onAddProtocol });

    const items = screen.getAllByTestId("command-item");
    expect(items).toHaveLength(3);

    // Verify clicking disabled items doesn't trigger onAddProtocol
    fireEvent.click(items[0]);
    expect(onAddProtocol).not.toHaveBeenCalled();
  });

  it("shows loading state", () => {
    renderPopover({ loading: true, availableProtocols: [] });

    expect(screen.getByText("experiments.searchingProtocols")).toBeInTheDocument();
  });

  it("shows no protocols found message when search has no results", () => {
    renderPopover({
      availableProtocols: [],
      searchValue: "nonexistent",
      loading: false,
    });

    expect(screen.getByText("experiments.noProtocolsFound")).toBeInTheDocument();
    expect(screen.getByText("experiments.tryDifferentSearchProtocols")).toBeInTheDocument();
    const searchIcons = screen.getAllByTestId("search-x-icon");
    expect(searchIcons.length).toBeGreaterThan(0);
  });

  it("shows no protocols available message when no search and no protocols", () => {
    renderPopover({
      availableProtocols: [],
      searchValue: "",
      loading: false,
    });

    expect(screen.getByText("experiments.noProtocolsAvailable")).toBeInTheDocument();
    expect(screen.getByText("experiments.createFirstProtocol")).toBeInTheDocument();
  });

  it("forwards search value and onSearchChange to input", () => {
    const onSearchChange = vi.fn();
    renderPopover({ searchValue: "test", onSearchChange });

    const input = screen.getByTestId("command-input");
    expect(input).toHaveValue("test");

    fireEvent.change(input, { target: { value: "new search" } });

    expect(onSearchChange).toHaveBeenCalledWith("new search");
  });

  it("uses correct popover width", () => {
    renderPopover();

    const popoverContent = screen.getByTestId("popover-content");
    expect(popoverContent).toHaveClass("w-[var(--radix-popover-trigger-width)]");
  });

  it("sets correct data-value attributes on command items", () => {
    renderPopover();

    const items = screen.getAllByTestId("command-item");
    expect(items[0]).toHaveAttribute("data-value", "p1");
    expect(items[1]).toHaveAttribute("data-value", "p2");
    expect(items[2]).toHaveAttribute("data-value", "p3");
  });

  it("calls onAddProtocol when command item is clicked (basic functionality)", async () => {
    const onAddProtocol = vi.fn();
    renderPopover({ onAddProtocol });

    const items = screen.getAllByTestId("command-item");
    await userEvent.click(items[0]);

    expect(onAddProtocol).toHaveBeenCalledWith("p1");
  });

  it("renders preferred badge for protocols with sortOrder", () => {
    renderPopover();

    const badge = screen.getByText("common.preferred");
    expect(badge).toBeInTheDocument();
  });
});
