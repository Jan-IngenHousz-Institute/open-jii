import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { DeleteAnnotationsDialog } from "~/components/experiment-data/annotations/delete-annotations-dialog";

// Hoisted mocks
const mockMutateDeleteAnnotationsBulk = vi.hoisted(() => vi.fn());
const { mockToast } = vi.hoisted(() => {
  const mockToast = vi.fn();

  return { mockToast };
});

// Mock hooks
vi.mock(
  "~/hooks/experiment/useExperimentDeleteAnnotationsBulk/useExperimentDeleteAnnotationsBulk",
  () => ({
    useExperimentDeleteAnnotationsBulk: () => ({
      mutateAsync: mockMutateDeleteAnnotationsBulk,
    }),
  }),
);

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({
    className,
    type,
    onClick,
    children,
  }: {
    className?: string;
    type?: string;
    onClick?: () => void;
    children?: React.ReactNode;
  }) => (
    <button data-testid={`button${type ? "-" + type : ""}`} className={className} onClick={onClick}>
      {children ?? "Button"}
    </button>
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

// Mock toast
vi.mock("@repo/ui/hooks", () => ({
  toast: mockToast,
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
      <DeleteAnnotationsDialog
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

    expect(screen.queryByTestId("dialog-title")).toHaveTextContent(
      "experimentDataAnnotations.commentDeleteDialog.title",
    );
    expect(screen.queryByTestId("dialog-description")).toHaveTextContent(
      "experimentDataAnnotations.commentDeleteDialog.description",
    );
    expect(screen.queryByTestId("dialog-close")).toHaveTextContent("common.cancel");
    expect(screen.queryByTestId("button-submit")).toHaveTextContent(
      "experimentDataAnnotations.commentDeleteDialog.delete",
    );
  });

  it("should handle form submission for deleting comments", async () => {
    render(
      <DeleteAnnotationsDialog
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

    const submitButton = screen.queryByTestId("button-submit");
    if (submitButton) fireEvent.click(submitButton);

    await vi.waitFor(() => {
      expect(mockMutateDeleteAnnotationsBulk).toHaveBeenCalledWith({
        params: {
          id: "exp1",
        },
        body: {
          tableName: "table1",
          rowIds: ["row1", "row2", "row3"],
          type: "comment",
        },
      });

      expect(mockToast).toHaveBeenCalledWith({
        description: "experimentDataAnnotations.deleted.comments",
      });
    });
  });
});
