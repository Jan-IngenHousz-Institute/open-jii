import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { BulkActionsBar } from "./bulk-actions-bar";

// Mock UI components to make dropdown content visible in tests
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <div onClick={onClick}>{children}</div>,
  DropdownMenuSeparator: () => <div />,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock i18n to return translation keys
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${key}:${JSON.stringify(params)}`;
      }
      return key;
    },
  }),
}));

const mockProps = {
  rowIds: ["1", "2", "3"],
  tableRows: [
    { id: "1", annotations: JSON.stringify([{ type: "comment" }, { type: "flag" }]) },
    { id: "2", annotations: JSON.stringify([{ type: "comment" }]) },
    { id: "3", annotations: "[]" },
  ],
  downloadTable: vi.fn(),
  onAddAnnotation: vi.fn(),
  onDeleteAnnotations: vi.fn(),
};

describe("BulkActionsBar", () => {
  it("should render selected rows count", () => {
    render(<BulkActionsBar {...mockProps} />);

    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/experimentDataTable.rows/)).toBeInTheDocument();
    expect(screen.getByText(/experimentDataAnnotations.bulkActions.selected/)).toBeInTheDocument();
  });

  it("should render singular row text for single selection", () => {
    render(<BulkActionsBar {...mockProps} rowIds={["1"]} />);

    expect(
      screen.getByText("1 experimentDataTable.row experimentDataAnnotations.bulkActions.selected"),
    ).toBeInTheDocument();
    // Row text is part of the main count text above
  });

  it("should show comment and flag counts", () => {
    render(<BulkActionsBar {...mockProps} />);

    expect(screen.getByText(/2 comments/)).toBeInTheDocument();
    expect(screen.getByText(/1 flag/)).toBeInTheDocument();
  });

  it("should show no rows selected when empty", () => {
    render(<BulkActionsBar {...mockProps} rowIds={[]} />);

    expect(
      screen.getByText(/experimentDataAnnotations.bulkActions.noRowsSelected/),
    ).toBeInTheDocument();
  });

  it("should call downloadTable when download button clicked", () => {
    render(<BulkActionsBar {...mockProps} />);

    const downloadButton = screen.getByText(/experimentDataTable.download/);
    fireEvent.click(downloadButton);

    expect(mockProps.downloadTable).toHaveBeenCalled();
  });

  it("should open actions dropdown and show options", () => {
    render(<BulkActionsBar {...mockProps} />);

    expect(
      screen.getByText("experimentDataAnnotations.bulkActions.addComment"),
    ).toBeInTheDocument();
    expect(screen.getByText("experimentDataAnnotations.bulkActions.addFlag")).toBeInTheDocument();
    expect(
      screen.getByText("experimentDataAnnotations.bulkActions.removeAllComments"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("experimentDataAnnotations.bulkActions.removeAllFlags"),
    ).toBeInTheDocument();
  });

  it("should call onAddAnnotation when add comment clicked", () => {
    render(<BulkActionsBar {...mockProps} />);

    const addCommentButton = screen.getByText("experimentDataAnnotations.bulkActions.addComment");
    fireEvent.click(addCommentButton);

    expect(mockProps.onAddAnnotation).toHaveBeenCalledWith(["1", "2", "3"], "comment");
  });

  it("should call onAddAnnotation when add flag clicked", () => {
    render(<BulkActionsBar {...mockProps} />);

    const addFlagButton = screen.getByText("experimentDataAnnotations.bulkActions.addFlag");
    fireEvent.click(addFlagButton);

    expect(mockProps.onAddAnnotation).toHaveBeenCalledWith(["1", "2", "3"], "flag");
  });

  it("should call onDeleteAnnotations when remove comments clicked", () => {
    render(<BulkActionsBar {...mockProps} />);

    const removeCommentsButton = screen.getByText(
      "experimentDataAnnotations.bulkActions.removeAllComments",
    );
    fireEvent.click(removeCommentsButton);

    expect(mockProps.onDeleteAnnotations).toHaveBeenCalledWith(["1", "2", "3"], "comment");
  });

  it("should call onDeleteAnnotations when remove flags clicked", () => {
    render(<BulkActionsBar {...mockProps} />);

    const removeFlagsButton = screen.getByText(
      "experimentDataAnnotations.bulkActions.removeAllFlags",
    );
    fireEvent.click(removeFlagsButton);

    expect(mockProps.onDeleteAnnotations).toHaveBeenCalledWith(["1", "2", "3"], "flag");
  });

  it("should handle malformed annotations JSON gracefully", () => {
    const propsWithBadJson = {
      ...mockProps,
      tableRows: [
        { id: "1", annotations: "invalid json" },
        { id: "2", annotations: JSON.stringify([{ type: "comment" }]) },
      ],
    };

    expect(() => render(<BulkActionsBar {...propsWithBadJson} />)).not.toThrow();
    expect(screen.getByText(/1 comment/)).toBeInTheDocument();
  });

  it("should work without tableRows prop", () => {
    const propsWithoutTableRows = {
      ...mockProps,
      tableRows: undefined,
    };

    expect(() => render(<BulkActionsBar {...propsWithoutTableRows} />)).not.toThrow();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });
});
