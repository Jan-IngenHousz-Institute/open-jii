import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AddCommentDialogProps } from "~/components/experiment-data/comments/add-comment-dialog";
import { BulkActionsBar } from "~/components/experiment-data/comments/bulk-actions-bar";
import type { DeleteCommentsDialogProps } from "~/components/experiment-data/comments/delete-comment-dialog";

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "experimentDataComments.bulkActions.actions": "Actions",
        "experimentDataComments.bulkActions.selected": "selected",
        "experimentDataComments.bulkActions.addComment": "Add comment",
        "experimentDataComments.bulkActions.addFlag": "Add flag",
        "experimentDataComments.bulkActions.removeAllComments": "Remove all comments",
        "experimentDataComments.bulkActions.removeAllFlags": "Remove all flags",
        "experimentDataTable.download": "Download",
      };
      return translations[key] || key;
    },
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

// Mock AddCommentDialog
vi.mock("~/components/experiment-data/comments/add-comment-dialog", () => ({
  AddCommentDialog: ({ type }: AddCommentDialogProps) => (
    <div data-testid={`add-comment-dialog-${type}`}>AddCommentDialog</div>
  ),
}));

// Mock DeleteCommentsDialog
vi.mock("~/components/experiment-data/comments/delete-comment-dialog", () => ({
  DeleteCommentsDialog: ({ type }: DeleteCommentsDialogProps) => (
    <div data-testid={`delete-comment-dialog-${type}`}>DeleteCommentsDialog</div>
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
    expect(menuItems[0]).toHaveTextContent("Add comment");
    expect(menuItems[0].ariaDisabled).toBe("true");
    expect(menuItems[1]).toHaveTextContent("Add flag");
    expect(menuItems[1].ariaDisabled).toBe("true");
    expect(menuItems[2]).toHaveTextContent("Remove all comments");
    expect(menuItems[2].ariaDisabled).toBe("true");
    expect(menuItems[3]).toHaveTextContent("Remove all flags");
    expect(menuItems[3].ariaDisabled).toBe("true");
    expect(screen.getByTestId("add-comment-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("add-comment-dialog-flag")).toBeInTheDocument();
    expect(screen.getByTestId("delete-comment-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("delete-comment-dialog-flag")).toBeInTheDocument();
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
    expect(menuItems[0]).toHaveTextContent("Add comment");
    expect(menuItems[0].ariaDisabled).toBe("false");
    expect(menuItems[1]).toHaveTextContent("Add flag");
    expect(menuItems[1].ariaDisabled).toBe("false");
    expect(menuItems[2]).toHaveTextContent("Remove all comments");
    expect(menuItems[2].ariaDisabled).toBe("false");
    expect(menuItems[3]).toHaveTextContent("Remove all flags");
    expect(menuItems[3].ariaDisabled).toBe("true");
    expect(screen.getByTestId("add-comment-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("add-comment-dialog-flag")).toBeInTheDocument();
    expect(screen.getByTestId("delete-comment-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("delete-comment-dialog-flag")).toBeInTheDocument();
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
    expect(menuItems[0]).toHaveTextContent("Add comment");
    expect(menuItems[0].ariaDisabled).toBe("false");
    expect(menuItems[1]).toHaveTextContent("Add flag");
    expect(menuItems[1].ariaDisabled).toBe("false");
    expect(menuItems[2]).toHaveTextContent("Remove all comments");
    expect(menuItems[2].ariaDisabled).toBe("true");
    expect(menuItems[3]).toHaveTextContent("Remove all flags");
    expect(menuItems[3].ariaDisabled).toBe("false");
    expect(screen.getByTestId("add-comment-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("add-comment-dialog-flag")).toBeInTheDocument();
    expect(screen.getByTestId("delete-comment-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("delete-comment-dialog-flag")).toBeInTheDocument();
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
    expect(menuItems[0]).toHaveTextContent("Add comment");
    expect(menuItems[0].ariaDisabled).toBe("false");
    expect(menuItems[1]).toHaveTextContent("Add flag");
    expect(menuItems[1].ariaDisabled).toBe("false");
    expect(menuItems[2]).toHaveTextContent("Remove all comments");
    expect(menuItems[2].ariaDisabled).toBe("false");
    expect(menuItems[3]).toHaveTextContent("Remove all flags");
    expect(menuItems[3].ariaDisabled).toBe("false");
    expect(screen.getByTestId("add-comment-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("add-comment-dialog-flag")).toBeInTheDocument();
    expect(screen.getByTestId("delete-comment-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("delete-comment-dialog-flag")).toBeInTheDocument();
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
    const downloadButton = screen.getByText("Download");
    expect(downloadButton).toBeInTheDocument();

    await user.click(downloadButton);

    // Check that function was called
    expect(downloadTableFunction).toHaveBeenCalledTimes(1);
  });
});
