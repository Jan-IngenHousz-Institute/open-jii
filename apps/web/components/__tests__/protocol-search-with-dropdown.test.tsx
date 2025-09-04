import "@testing-library/jest-dom";
import { render, screen, act } from "@testing-library/react";
import Image from "next/image";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Protocol } from "@repo/api";

import { ProtocolSearchWithDropdown } from "../protocol-search-with-dropdown";

globalThis.React = React;

// --------------------
// Mocks
// --------------------
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) =>
      ({
        "common.protocolLabel": "Protocol",
        "common.by": "by",
        "experiments.searchProtocols": "Search protocols…",
      })[k] ?? k,
  }),
}));

interface PopoverPropsCaptured {
  availableProtocols: Protocol[];
  searchValue: string;
  onSearchChange: (v: string) => void;
  onAddProtocol: (id: string) => void | Promise<void>;
  isAddingProtocol: boolean;
  loading?: boolean;
  setOpen: (v: boolean) => void;
}
let lastPopoverProps: PopoverPropsCaptured | null = null;

vi.mock("../protocol-search-popover", () => ({
  ProtocolSearchPopover: (props: PopoverPropsCaptured) => {
    lastPopoverProps = props;
    return (
      <div data-testid="protocol-popover">
        <span data-testid="dropdown-count">{props.availableProtocols.length}</span>
      </div>
    );
  },
}));

vi.mock("@repo/ui/components", () => {
  const Button = ({
    children,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { role?: string }) => (
    <button {...rest}>{children}</button>
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
}));

// --------------------
// Test data & helpers
// --------------------
const protocols: Protocol[] = [
  {
    id: "p1",
    name: "PCR Master",
    description: null,
    code: [],
    family: "multispeq",
    createdBy: "user1",
    createdAt: "2025-09-04T00:00:00Z",
    updatedAt: "2025-09-04T00:00:00Z",
    createdByName: "Ada Lovelace",
  } as Protocol,
  {
    id: "p2",
    name: "RNA-Seq",
    description: null,
    code: [],
    family: "ambit",
    createdBy: "user2",
    createdAt: "2025-09-04T00:00:00Z",
    updatedAt: "2025-09-04T00:00:00Z",
    createdByName: "Al Turing",
  } as Protocol,
  {
    id: "p3",
    name: "CRISPR Edit",
    description: null,
    code: [],
    family: "multispeq",
    createdBy: "user3",
    createdAt: "2025-09-04T00:00:00Z",
    updatedAt: "2025-09-04T00:00:00Z",
  } as Protocol,
];

function renderWidget(over: Partial<React.ComponentProps<typeof ProtocolSearchWithDropdown>> = {}) {
  const props: React.ComponentProps<typeof ProtocolSearchWithDropdown> = {
    availableProtocols: protocols,
    value: over.value ?? "",
    placeholder: "Pick a protocol",
    loading: false,
    searchValue: "",
    onSearchChange: vi.fn(),
    onAddProtocol: vi.fn(),
    isAddingProtocol: false,
    ...over,
  };
  lastPopoverProps = null;
  return {
    ...render(<ProtocolSearchWithDropdown {...props} />),
    props,
  };
}

// --------------------
// Tests
// --------------------
describe("<ProtocolSearchWithDropdown />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastPopoverProps = null;
  });

  it("renders placeholder when no protocol is selected", () => {
    renderWidget({ value: "" });
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Pick a protocol")).toBeInTheDocument();
  });

  it("filters dropdown list to exclude currently selected protocol", () => {
    renderWidget({ value: "p2" });
    expect(lastPopoverProps).not.toBeNull();
    const ids = lastPopoverProps?.availableProtocols.map((p) => p.id);
    expect(ids).toContain("p1");
    expect(ids).toContain("p3");
    expect(ids).not.toContain("p2");
    expect(screen.getByTestId("dropdown-count")).toHaveTextContent("2");
  });

  it("forwards search callback and add callback to the popover", async () => {
    const onSearchChange = vi.fn();
    const onAddProtocol = vi.fn();
    renderWidget({ value: "p1", onSearchChange, onAddProtocol, searchValue: "abc" });

    const props = lastPopoverProps;
    expect(props?.searchValue).toBe("abc");

    props?.onSearchChange("new");
    expect(onSearchChange).toHaveBeenCalledWith("new");

    await Promise.resolve(props?.onAddProtocol("p3"));
    expect(onAddProtocol).toHaveBeenCalledWith("p3");
  });

  it("exposes setOpen via child and updates aria-expanded when invoked", () => {
    renderWidget({ value: "p1" });

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

  it("passes loading and isAddingProtocol flags straight through", () => {
    renderWidget({ value: "p1", loading: true, isAddingProtocol: true });
    const props = lastPopoverProps;
    expect(props?.loading).toBe(true);
    expect(props?.isAddingProtocol).toBe(true);
  });
});
