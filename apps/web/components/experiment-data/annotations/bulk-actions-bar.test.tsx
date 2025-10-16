import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AddAnnotationDialogProps } from "~/components/experiment-data/annotations/add-annotation-dialog";
import { BulkActionsBar } from "~/components/experiment-data/annotations/bulk-actions-bar";
import type { DeleteAnnotationsDialogProps } from "~/components/experiment-data/annotations/delete-annotations-dialog";

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    className,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children ?? "DropdownMenu"}</div>
  ),
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dropdown-menu-content">{children ?? "DropdownMenuContent"}</div>
  ),
  DropdownMenuItem: ({
    disabled,
    children,
  }: {
    disabled?: boolean;
    children?: React.ReactNode;
  }) => (
    <div data-testid="dropdown-menu-item" aria-disabled={disabled}>
      {children ?? "DropdownMenuItem"}
    </div>
  ),
  DropdownMenuSeparator: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dropdown-menu-separator">{children ?? "DropdownMenuSeparator"}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dropdown-menu-trigger">{children ?? "DropdownMenuTrigger"}</div>
  ),
}));

// Mock AddAnnotationDialog
vi.mock("~/components/experiment-data/annotations/add-annotation-dialog", () => ({
  AddAnnotationDialog: ({ type }: AddAnnotationDialogProps) => (
    <div data-testid={`add-annotation-dialog-${type}`}>AddCommentDialog</div>
  ),
}));

// Mock DeleteAnnotationsDialog
vi.mock("~/components/experiment-data/annotations/delete-annotations-dialog", () => ({
  DeleteAnnotationsDialog: ({ type }: DeleteAnnotationsDialogProps) => (
    <div data-testid={`delete-annotations-dialog-${type}`}>DeleteCommentsDialog</div>
  ),
}));

describe("BulkActionsBar", () => {
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

  it("should render for no selected rows", () => {
    render(
      <BulkActionsBar
        experimentId="exp1"
        tableName="table1"
        rowIds={[]}
        totalComments={0}
        totalFlags={0}
        clearSelection={vi.fn()}
        downloadTable={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId("dropdown-menu-trigger")).toHaveTextContent("Actions");
    const menuItems = screen.getAllByTestId("dropdown-menu-item");
    expect(menuItems).toHaveLength(4);
    expect(menuItems[0]).toHaveTextContent("experimentDataAnnotations.bulkActions.addComment");
    expect(menuItems[0].ariaDisabled).toBe("true");
    expect(menuItems[1]).toHaveTextContent("experimentDataAnnotations.bulkActions.addFlag");
    expect(menuItems[1].ariaDisabled).toBe("true");
    expect(menuItems[2]).toHaveTextContent(
      "experimentDataAnnotations.bulkActions.removeAllComments",
    );
    expect(menuItems[2].ariaDisabled).toBe("true");
    expect(menuItems[3]).toHaveTextContent("experimentDataAnnotations.bulkActions.removeAllFlags");
    expect(menuItems[3].ariaDisabled).toBe("true");
    expect(screen.getByTestId("add-annotation-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("add-annotation-dialog-flag")).toBeInTheDocument();
    expect(screen.getByTestId("delete-annotations-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("delete-annotations-dialog-flag")).toBeInTheDocument();
  });

  it("should render for selected rows > 0, comments > 0 and flags = 0", () => {
    render(
      <BulkActionsBar
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1", "row2", "row3"]}
        totalComments={5}
        totalFlags={0}
        clearSelection={vi.fn()}
        downloadTable={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId("dropdown-menu-trigger")).toHaveTextContent("Actions");
    const menuItems = screen.getAllByTestId("dropdown-menu-item");
    expect(menuItems).toHaveLength(4);
    expect(menuItems[0]).toHaveTextContent("experimentDataAnnotations.bulkActions.addComment");
    expect(menuItems[0].ariaDisabled).toBe("false");
    expect(menuItems[1]).toHaveTextContent("experimentDataAnnotations.bulkActions.addFlag");
    expect(menuItems[1].ariaDisabled).toBe("false");
    expect(menuItems[2]).toHaveTextContent(
      "experimentDataAnnotations.bulkActions.removeAllComments",
    );
    expect(menuItems[2].ariaDisabled).toBe("false");
    expect(menuItems[3]).toHaveTextContent("experimentDataAnnotations.bulkActions.removeAllFlags");
    expect(menuItems[3].ariaDisabled).toBe("true");
    expect(screen.getByTestId("add-annotation-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("add-annotation-dialog-flag")).toBeInTheDocument();
    expect(screen.getByTestId("delete-annotations-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("delete-annotations-dialog-flag")).toBeInTheDocument();
  });

  it("should render for selected rows > 0, comments = 0 and flags > 0", () => {
    render(
      <BulkActionsBar
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1", "row2", "row3"]}
        totalComments={0}
        totalFlags={2}
        clearSelection={vi.fn()}
        downloadTable={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId("dropdown-menu-trigger")).toHaveTextContent("Actions");
    const menuItems = screen.getAllByTestId("dropdown-menu-item");
    expect(menuItems).toHaveLength(4);
    expect(menuItems[0]).toHaveTextContent("experimentDataAnnotations.bulkActions.addComment");
    expect(menuItems[0].ariaDisabled).toBe("false");
    expect(menuItems[1]).toHaveTextContent("experimentDataAnnotations.bulkActions.addFlag");
    expect(menuItems[1].ariaDisabled).toBe("false");
    expect(menuItems[2]).toHaveTextContent(
      "experimentDataAnnotations.bulkActions.removeAllComments",
    );
    expect(menuItems[2].ariaDisabled).toBe("true");
    expect(menuItems[3]).toHaveTextContent("experimentDataAnnotations.bulkActions.removeAllFlag");
    expect(menuItems[3].ariaDisabled).toBe("false");
    expect(screen.getByTestId("add-annotation-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("add-annotation-dialog-flag")).toBeInTheDocument();
    expect(screen.getByTestId("delete-annotations-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("delete-annotations-dialog-flag")).toBeInTheDocument();
  });

  it("should render for selected rows > 0, comments > 0 and flags > 0", () => {
    render(
      <BulkActionsBar
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1", "row2", "row3"]}
        totalComments={5}
        totalFlags={2}
        clearSelection={vi.fn()}
        downloadTable={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId("dropdown-menu-trigger")).toHaveTextContent("Actions");
    const menuItems = screen.getAllByTestId("dropdown-menu-item");
    expect(menuItems).toHaveLength(4);
    expect(menuItems[0]).toHaveTextContent("experimentDataAnnotations.bulkActions.addComment");
    expect(menuItems[0].ariaDisabled).toBe("false");
    expect(menuItems[1]).toHaveTextContent("experimentDataAnnotations.bulkActions.addFlag");
    expect(menuItems[1].ariaDisabled).toBe("false");
    expect(menuItems[2]).toHaveTextContent(
      "experimentDataAnnotations.bulkActions.removeAllComments",
    );
    expect(menuItems[2].ariaDisabled).toBe("false");
    expect(menuItems[3]).toHaveTextContent("experimentDataAnnotations.bulkActions.removeAllFlag");
    expect(menuItems[3].ariaDisabled).toBe("false");
    expect(screen.getByTestId("add-annotation-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("add-annotation-dialog-flag")).toBeInTheDocument();
    expect(screen.getByTestId("delete-annotations-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("delete-annotations-dialog-flag")).toBeInTheDocument();
  });

  it("should render download button and open modal", async () => {
    const user = userEvent.setup();
    const downloadTableFunction = vi.fn();
    render(
      <BulkActionsBar
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1", "row2", "row3"]}
        totalComments={5}
        totalFlags={2}
        clearSelection={vi.fn()}
        downloadTable={downloadTableFunction}
      />,
      { wrapper: createWrapper() },
    );

    // Find and click download button
    const downloadButton = screen.getByText("experimentDataTable.download");
    expect(downloadButton).toBeInTheDocument();

    await user.click(downloadButton);

    // Check that function was called
    expect(downloadTableFunction).toHaveBeenCalledTimes(1);
  });
});
