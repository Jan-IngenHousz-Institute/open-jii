import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { BulkActionsBar } from "./bulk-actions-bar";

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

  it("should call downloadTable when download button clicked", async () => {
    const user = userEvent.setup();
    render(<BulkActionsBar {...mockProps} />);

    const downloadButton = screen.getByText(/experimentDataTable.download/);
    await user.click(downloadButton);

    expect(mockProps.downloadTable).toHaveBeenCalled();
  });

  it("should open actions dropdown and show options", async () => {
    const user = userEvent.setup();
    render(<BulkActionsBar {...mockProps} />);

    await user.click(
      screen.getByRole("button", {
        name: /experimentDataAnnotations.bulkActions.actions/,
      }),
    );

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

  it("should call onAddAnnotation when add comment clicked", async () => {
    const user = userEvent.setup();
    render(<BulkActionsBar {...mockProps} />);

    await user.click(
      screen.getByRole("button", {
        name: /experimentDataAnnotations.bulkActions.actions/,
      }),
    );
    await user.click(screen.getByText("experimentDataAnnotations.bulkActions.addComment"));

    expect(mockProps.onAddAnnotation).toHaveBeenCalledWith(["1", "2", "3"], "comment");
  });

  it("should call onAddAnnotation when add flag clicked", async () => {
    const user = userEvent.setup();
    render(<BulkActionsBar {...mockProps} />);

    await user.click(
      screen.getByRole("button", {
        name: /experimentDataAnnotations.bulkActions.actions/,
      }),
    );
    await user.click(screen.getByText("experimentDataAnnotations.bulkActions.addFlag"));

    expect(mockProps.onAddAnnotation).toHaveBeenCalledWith(["1", "2", "3"], "flag");
  });

  it("should call onDeleteAnnotations when remove comments clicked", async () => {
    const user = userEvent.setup();
    render(<BulkActionsBar {...mockProps} />);

    await user.click(
      screen.getByRole("button", {
        name: /experimentDataAnnotations.bulkActions.actions/,
      }),
    );
    await user.click(screen.getByText("experimentDataAnnotations.bulkActions.removeAllComments"));

    expect(mockProps.onDeleteAnnotations).toHaveBeenCalledWith(["1", "2", "3"], "comment");
  });

  it("should call onDeleteAnnotations when remove flags clicked", async () => {
    const user = userEvent.setup();
    render(<BulkActionsBar {...mockProps} />);

    await user.click(
      screen.getByRole("button", {
        name: /experimentDataAnnotations.bulkActions.actions/,
      }),
    );
    await user.click(screen.getByText("experimentDataAnnotations.bulkActions.removeAllFlags"));

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
