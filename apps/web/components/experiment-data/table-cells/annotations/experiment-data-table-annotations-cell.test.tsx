import { render, screen, userEvent } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Annotation } from "@repo/api";

import { ExperimentDataTableAnnotationsCell } from "./experiment-data-table-annotations-cell";

// Mock date utility
vi.mock("~/util/date", () => ({
  formatDate: (date: string) => `formatted-${date}`,
}));

const sampleAnnotations: Annotation[] = [
  {
    id: "1",
    type: "comment",
    content: { type: "comment", text: "This is a comment" },
    createdAt: "2023-01-01T00:00:00Z",
    createdBy: "user-1",
    createdByName: "John Doe",
    updatedAt: "2023-01-01T00:00:00Z",
  },
  {
    id: "2",
    type: "flag",
    content: { type: "flag", flagType: "outlier", text: "This is an outlier" },
    createdAt: "2023-01-02T00:00:00Z",
    createdBy: "user-2",
    createdByName: "Jane Smith",
    updatedAt: "2023-01-02T00:00:00Z",
  },
  {
    id: "3",
    type: "flag",
    content: { type: "flag", flagType: "needs_review", text: "Needs review" },
    createdAt: "2023-01-03T00:00:00Z",
    createdBy: "user-3",
    createdByName: "Bob Wilson",
    updatedAt: "2023-01-03T00:00:00Z",
  },
];

const mockProps = {
  data: JSON.stringify(sampleAnnotations),
  rowId: "row-123",
  onAddAnnotation: vi.fn(),
  onDeleteAnnotations: vi.fn(),
};

describe("ExperimentDataTableAnnotationsCell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render comment and flag badges", () => {
    render(<ExperimentDataTableAnnotationsCell {...mockProps} />);

    expect(screen.getByText("1")).toBeInTheDocument(); // comment count
    expect(screen.getByText("2")).toBeInTheDocument(); // flag count
  });

  it("should render empty state when no annotations", () => {
    render(<ExperimentDataTableAnnotationsCell {...mockProps} data="[]" />);

    expect(screen.getByText(/common.add/)).toBeInTheDocument();
  });

  it("should handle malformed JSON gracefully", () => {
    render(<ExperimentDataTableAnnotationsCell {...mockProps} data="invalid json" />);

    expect(screen.getByText(/common.add/)).toBeInTheDocument();
  });

  it("should open comments popover and show details", async () => {
    const user = userEvent.setup();
    render(<ExperimentDataTableAnnotationsCell {...mockProps} />);

    const commentBadge = screen.getByText("1");
    await user.click(commentBadge);

    expect(screen.getByText(/experimentDataAnnotations.comments/)).toBeInTheDocument();
    expect(screen.getByText("This is a comment")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("formatted-2023-01-01T00:00:00Z")).toBeInTheDocument();
  });

  it("should open flags popover and show details", async () => {
    const user = userEvent.setup();
    render(<ExperimentDataTableAnnotationsCell {...mockProps} />);

    const flagBadge = screen.getByText("2");
    await user.click(flagBadge);

    expect(screen.getByText(/experimentDataAnnotations.flags/)).toBeInTheDocument();
    expect(screen.getByText("This is an outlier")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
  });

  it("should show flag type badges in flags popover", async () => {
    const user = userEvent.setup();
    render(<ExperimentDataTableAnnotationsCell {...mockProps} />);

    const flagBadge = screen.getByText("2");
    await user.click(flagBadge);

    // Check flag types are displayed - they appear as "experimentDataAnnotations.flagTypes.outlier" and "experimentDataAnnotations.flagTypes.needs_review"
    expect(screen.getByText("experimentDataAnnotations.flagTypes.outlier")).toBeInTheDocument();
    expect(
      screen.getByText("experimentDataAnnotations.flagTypes.needs_review"),
    ).toBeInTheDocument();
  });

  it("should call onAddAnnotation when add comment is clicked in comments popover", async () => {
    const user = userEvent.setup();
    render(<ExperimentDataTableAnnotationsCell {...mockProps} />);

    const commentBadge = screen.getByText("1");
    await user.click(commentBadge);

    const addButton = screen.getAllByTitle(/experimentDataAnnotations.addComment/)[0];
    await user.click(addButton);

    expect(mockProps.onAddAnnotation).toHaveBeenCalledWith(["row-123"], "comment");
  });

  it("should call onDeleteAnnotations when delete comments is clicked", async () => {
    const user = userEvent.setup();
    render(<ExperimentDataTableAnnotationsCell {...mockProps} />);

    const commentBadge = screen.getByText("1");
    await user.click(commentBadge);

    const deleteButton = screen.getByTitle(
      /experimentDataAnnotations.bulkActions.removeAllComments/,
    );
    await user.click(deleteButton);

    expect(mockProps.onDeleteAnnotations).toHaveBeenCalledWith(["row-123"], "comment");
  });

  it("should call onAddAnnotation when add flag is clicked in flags popover", async () => {
    const user = userEvent.setup();
    render(<ExperimentDataTableAnnotationsCell {...mockProps} />);

    const flagBadge = screen.getByText("2");
    await user.click(flagBadge);

    const addButton = screen.getByTitle(/experimentDataAnnotations.addFlag/);
    await user.click(addButton);

    expect(mockProps.onAddAnnotation).toHaveBeenCalledWith(["row-123"], "flag");
  });

  it("should call onDeleteAnnotations when delete flags is clicked", async () => {
    const user = userEvent.setup();
    render(<ExperimentDataTableAnnotationsCell {...mockProps} />);

    const flagBadge = screen.getByText("2");
    await user.click(flagBadge);

    const deleteButton = screen.getByTitle(/experimentDataAnnotations.bulkActions.removeAllFlags/);
    await user.click(deleteButton);

    expect(mockProps.onDeleteAnnotations).toHaveBeenCalledWith(["row-123"], "flag");
  });

  it("should handle empty annotations popover actions", async () => {
    const user = userEvent.setup();
    render(<ExperimentDataTableAnnotationsCell {...mockProps} data="[]" />);

    const addButton = screen.getByText(/common.add/);
    await user.click(addButton);

    expect(screen.getByText(/experimentDataAnnotations.annotations/)).toBeInTheDocument();
    expect(screen.getByText("experimentDataAnnotations.noAnnotations")).toBeInTheDocument();
    expect(
      screen.getByText(/experimentDataAnnotations.noAnnotationsDescription/),
    ).toBeInTheDocument();
  });

  it("should call onAddAnnotation from empty state for comments", async () => {
    const user = userEvent.setup();
    render(<ExperimentDataTableAnnotationsCell {...mockProps} data="[]" />);

    const addButton = screen.getByText(/common.add/);
    await user.click(addButton);

    const addCommentButton = screen.getByTitle(/experimentDataAnnotations.addComment/);
    await user.click(addCommentButton);

    expect(mockProps.onAddAnnotation).toHaveBeenCalledWith(["row-123"], "comment");
  });

  it("should call onAddAnnotation from empty state for flags", async () => {
    const user = userEvent.setup();
    render(<ExperimentDataTableAnnotationsCell {...mockProps} data="[]" />);

    const addButton = screen.getByText(/common.add/);
    await user.click(addButton);

    const addFlagButton = screen.getByTitle(/experimentDataAnnotations.addFlag/);
    await user.click(addFlagButton);

    expect(mockProps.onAddAnnotation).toHaveBeenCalledWith(["row-123"], "flag");
  });

  it("should handle annotations without createdByName", async () => {
    const user = userEvent.setup();
    const annotationsWithoutName = [
      {
        id: "1",
        type: "comment",
        content: { type: "comment", text: "Anonymous comment" },
        createdAt: "2023-01-01",
      },
    ];

    render(
      <ExperimentDataTableAnnotationsCell
        {...mockProps}
        data={JSON.stringify(annotationsWithoutName)}
      />,
    );

    const commentBadge = screen.getByText("1");
    await user.click(commentBadge);

    expect(screen.getByText("experimentDataAnnotations.unknownUser")).toBeInTheDocument();
    expect(screen.getByText("Anonymous comment")).toBeInTheDocument();
  });

  it("should work without optional callback props", () => {
    const propsWithoutCallbacks = {
      data: JSON.stringify(sampleAnnotations),
      rowId: "row-123",
    };

    expect(() =>
      render(<ExperimentDataTableAnnotationsCell {...propsWithoutCallbacks} />),
    ).not.toThrow();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("should skip annotations with invalid types", () => {
    const mixedAnnotations = [
      ...sampleAnnotations,
      { id: "4", type: "note", content: { type: "note", text: "Invalid note" } },
    ];

    render(
      <ExperimentDataTableAnnotationsCell {...mockProps} data={JSON.stringify(mixedAnnotations)} />,
    );

    // Should still show 1 comment and 2 flags, skipping the invalid "note"
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("should show empty state when all annotations have invalid types", () => {
    const invalidAnnotations = [{ id: "1", type: "note", content: { type: "note", text: "Note" } }];

    render(
      <ExperimentDataTableAnnotationsCell
        {...mockProps}
        data={JSON.stringify(invalidAnnotations)}
      />,
    );
    expect(screen.getByText(/common.add/)).toBeInTheDocument();
  });
});
