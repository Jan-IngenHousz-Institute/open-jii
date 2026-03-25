import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MetadataUploadStep } from "./metadata-upload-step";

globalThis.React = React;

vi.mock("@/components/metadata-table", () => ({
  MetadataTable: () => <div data-testid="metadata-table">Table</div>,
}));

vi.mock("@/components/metadata-table/utils/parse-metadata-import", () => ({
  parseClipboard: vi.fn(),
  parseClipboardText: vi.fn(),
  parseFile: vi.fn(),
}));

vi.mock("@/hooks/experiment/useExperimentFlow/useExperimentFlow", () => ({
  useExperimentFlow: () => ({ data: null, isLoading: false, error: null }),
}));

vi.mock("@/hooks/experiment/useExperimentMetadataCreate/useExperimentMetadataCreate", () => ({
  useExperimentMetadataCreate: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Label: ({ children, ...props }: { children: React.ReactNode; htmlFor?: string }) => (
    <label {...props}>{children}</label>
  ),
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock("@repo/ui/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => <span />,
  ClipboardPaste: () => <span />,
  FileSpreadsheet: () => <span />,
  Trash2: () => <span />,
  Upload: () => <span />,
}));

describe("MetadataUploadStep – Save Metadata button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderStep = () =>
    render(
      <MetadataUploadStep
        experimentId="test-experiment"
        onBack={vi.fn()}
        onUploadSuccess={vi.fn()}
      />,
    );

  const getSaveButton = () => {
    const el = screen.getByText("uploadModal.metadata.saveMetadata").closest("button");
    if (!el) throw new Error("Save button not found");
    return el;
  };

  it("is disabled when no data is loaded (empty state)", () => {
    renderStep();
    // In empty state the save button should still be present and disabled
    expect(getSaveButton()).toBeDisabled();
  });

  it("renders the import prompt when no data is loaded", () => {
    renderStep();
    expect(screen.getByText("uploadModal.metadata.importPrompt")).toBeInTheDocument();
  });
});
