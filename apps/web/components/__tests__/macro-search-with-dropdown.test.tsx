import "@testing-library/jest-dom";
import { render, screen, act } from "@testing-library/react";
import Image from "next/image";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Macro } from "@repo/api";

import { MacroSearchWithDropdown } from "../macro-search-with-dropdown";

globalThis.React = React;

// --------------------
// Mocks
// --------------------
vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => "en",
}));

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

interface PopoverPropsCaptured {
  availableMacros: Macro[];
  searchValue: string;
  onSearchChange: (v: string) => void;
  onAddMacro: (id: string) => void | Promise<void>;
  isAddingMacro: boolean;
  loading?: boolean;
  setOpen: (v: boolean) => void;
  popoverClassName?: string;
}
let lastPopoverProps: PopoverPropsCaptured | null = null;

vi.mock("../macro-search-popover", () => ({
  MacroSearchPopover: (props: PopoverPropsCaptured) => {
    lastPopoverProps = props;
    return (
      <div data-testid="macro-popover">
        <span data-testid="dropdown-count">{props.availableMacros.length}</span>
      </div>
    );
  },
}));

vi.mock("@repo/ui/components", () => {
  const Button = ({
    children,
    className,
    variant: _variant,
    role,
    disabled,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    role?: string;
    variant?: string;
    className?: string;
  }) => (
    <button {...rest} className={className} role={role} disabled={disabled}>
      {children}
    </button>
  );

  const Avatar = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="avatar" className={className}>
      {children}
    </div>
  );

  const AvatarImage = (
    props: React.ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string },
  ) => {
    const { width, height, ...rest } = props;
    return (
      <Image
        data-testid="avatar-image"
        width={typeof width === "string" ? parseInt(width, 10) : width}
        height={typeof height === "string" ? parseInt(height, 10) : height}
        {...rest}
      />
    );
  };

  const AvatarFallback = ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="avatar-fallback" className={className}>
      {children}
    </div>
  );

  const Popover = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  const PopoverTrigger = ({ children }: React.PropsWithChildren) => <div>{children}</div>;

  return {
    Button,
    Avatar,
    AvatarImage,
    AvatarFallback,
    Popover,
    PopoverTrigger,
  };
});

vi.mock("lucide-react", () => ({
  ChevronsUpDown: ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  ),
  ExternalLink: ({ className }: { className?: string }) => (
    <span data-testid="external-link-icon" className={className} />
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

function renderWidget(over: Partial<React.ComponentProps<typeof MacroSearchWithDropdown>> = {}) {
  const props: React.ComponentProps<typeof MacroSearchWithDropdown> = {
    availableMacros: macros,
    value: over.value ?? "",
    placeholder: "experiments.pickMacro",
    loading: false,
    searchValue: "",
    onSearchChange: vi.fn(),
    onAddMacro: vi.fn(),
    isAddingMacro: false,
    ...over,
  };
  lastPopoverProps = null;
  return {
    ...render(<MacroSearchWithDropdown {...props} />),
    props,
  };
}

// --------------------
// Tests
// --------------------
describe("<MacroSearchWithDropdown />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastPopoverProps = null;
  });

  it("renders placeholder when no macro is selected", () => {
    renderWidget({ value: "" });
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("experiments.pickMacro")).toBeInTheDocument();
  });

  it("renders default placeholder when no custom placeholder and no macro is selected", () => {
    renderWidget({ value: "", placeholder: undefined });
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("experiments.searchMacros")).toBeInTheDocument();
  });

  it("filters dropdown list to exclude currently selected macro", () => {
    renderWidget({ value: "m2" });
    expect(lastPopoverProps).not.toBeNull();
    const ids = lastPopoverProps?.availableMacros.map((m) => m.id);
    expect(ids).toContain("m1");
    expect(ids).toContain("m3");
    expect(ids).not.toContain("m2");
    expect(screen.getByTestId("dropdown-count")).toHaveTextContent("2");
  });

  it("forwards search callback and add callback to the popover", async () => {
    const onSearchChange = vi.fn();
    const onAddMacro = vi.fn();
    renderWidget({ value: "m1", onSearchChange, onAddMacro, searchValue: "abc" });

    const props = lastPopoverProps;
    expect(props?.searchValue).toBe("abc");

    props?.onSearchChange("new");
    expect(onSearchChange).toHaveBeenCalledWith("new");

    await Promise.resolve(props?.onAddMacro("m3"));
    expect(onAddMacro).toHaveBeenCalledWith("m3");
  });

  it("exposes setOpen via child and updates aria-expanded when invoked", () => {
    renderWidget({ value: "m1" });

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    act(() => {
      lastPopoverProps?.setOpen(true);
    });
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "true");

    act(() => {
      lastPopoverProps?.setOpen(false);
    });
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
  });

  it("passes loading and isAddingMacro flags straight through", () => {
    renderWidget({ value: "m1", loading: true, isAddingMacro: true });
    const props = lastPopoverProps;
    expect(props?.loading).toBe(true);
    expect(props?.isAddingMacro).toBe(true);
  });

  it("respects disabled state", () => {
    renderWidget({ value: "m1", disabled: true });
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
  });

  it("passes correct popoverClassName to MacroSearchPopover", () => {
    renderWidget({ value: "m1" });
    const props = lastPopoverProps;
    expect(props?.popoverClassName).toBe("w-[var(--radix-popover-trigger-width)]");
  });
});
