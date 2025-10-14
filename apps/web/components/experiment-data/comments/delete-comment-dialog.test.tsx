import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { DeleteCommentsDialog } from "~/components/experiment-data/comments/delete-comment-dialog";

// Mock hooks
const useExperimentDataCommentsDeleteMock = vi.hoisted(() => vi.fn());
vi.mock(
  "~/hooks/experiment/useExperimentDataCommentsDelete/useExperimentDataCommentsDelete",
  () => ({
    useExperimentDataCommentsDelete: () => useExperimentDataCommentsDeleteMock,
  }),
);

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "common.cancel": "Cancel",
        "experimentDataComments.updated": "Comments and flags updated",
        "experimentDataComments.commentDeleteDialog.title": "Are you absolutely sure?",
        "experimentDataComments.commentDeleteDialog.description":
          "This action cannot be undone. This will permanently delete all comments from the selected 3 row(s).",
        "experimentDataComments.commentDeleteDialog.delete": "Delete",
        "experimentDataComments.flagDeleteDialog.title": "Are you absolutely sure?",
        "experimentDataComments.flagDeleteDialog.description":
          "This action cannot be undone. This will permanently delete all flags from the selected 3 row(s).",
        "experimentDataComments.flagDeleteDialog.delete": "Delete",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({
    className,
    type,
    children,
  }: {
    className?: string;
    type?: string;
    children?: React.ReactNode;
  }) => (
    <div data-testid={`button${type ? "-" + type : ""}`} className={className}>
      {children ?? "Button"}
    </div>
  ),
  Dialog: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog">{children ?? "Dialog"}</div>
  ),
  DialogClose: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-close">{children ?? "DialogClose"}</div>
  ),
  DialogContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-content">{children ?? "DialogContent"}</div>
  ),
  DialogDescription: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-description">{children ?? "DialogDescription"}</div>
  ),
  DialogFooter: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children ?? "DialogFooter"}</div>
  ),
  DialogHeader: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-header">{children ?? "DialogHeader"}</div>
  ),
  DialogTitle: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-title">{children ?? "DialogTitle"}</div>
  ),
  DialogTrigger: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-trigger">{children ?? "DialogTrigger"}</div>
  ),
}));

describe("DeleteCommentsDialog", () => {
  const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) => children;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Add event listener mocks
    vi.spyOn(window, "addEventListener").mockImplementation(() => {
      // Mock implementation
    });
    vi.spyOn(window, "removeEventListener").mockImplementation(() => {
      // Mock implementation
    });
  });

  it("should render dialog for deleting comments", () => {
    render(
      <DeleteCommentsDialog
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1", "row2", "row3"]}
        type="comment"
        bulkOpen={true}
        setBulkOpen={vi.fn()}
        clearSelection={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByTestId("dialog-title")).toHaveTextContent("Are you absolutely sure?");
    expect(screen.queryByTestId("dialog-description")).toHaveTextContent(
      "This action cannot be undone. This will permanently delete all comments from the selected 3 row(s).",
    );
    expect(screen.queryByTestId("dialog-close")).toHaveTextContent("Cancel");
    expect(screen.queryByTestId("button-submit")).toHaveTextContent("Delete");
  });

  it("should render dialog for deleting flags", () => {
    render(
      <DeleteCommentsDialog
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1", "row2", "row3"]}
        type="flag"
        bulkOpen={true}
        setBulkOpen={vi.fn()}
        clearSelection={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByTestId("dialog-title")).toHaveTextContent("Are you absolutely sure?");
    expect(screen.queryByTestId("dialog-description")).toHaveTextContent(
      "This action cannot be undone. This will permanently delete all flags from the selected 3 row(s).",
    );
    expect(screen.queryByTestId("dialog-close")).toHaveTextContent("Cancel");
    expect(screen.queryByTestId("button-submit")).toHaveTextContent("Delete");
  });
});
