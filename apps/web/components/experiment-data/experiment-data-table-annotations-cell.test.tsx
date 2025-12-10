import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Annotation } from "@repo/api";

import { ExperimentDataTableAnnotationsCell } from "./experiment-data-table-annotations-cell";

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

// Mock UI components to make popover and dialog testable
vi.mock("@repo/ui/components", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => children,
  Button: ({
    children,
    onClick,
    title,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    title?: string;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} title={title} {...props}>
      {children}
    </button>
  ),
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span className={variant}>{children}</span>
  ),
}));

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

  it("should open comments popover and show details", () => {
    render(<ExperimentDataTableAnnotationsCell {...mockProps} />);

    const commentBadge = screen.getByText("1");
    fireEvent.click(commentBadge);

    expect(screen.getByText(/experimentDataAnnotations.comments/)).toBeInTheDocument();
    expect(screen.getByText("This is a comment")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("formatted-2023-01-01T00:00:00Z")).toBeInTheDocument();
  });

  it("should open flags popover and show details", () => {
    render(<ExperimentDataTableAnnotationsCell {...mockProps} />);

    const flagBadge = screen.getByText("2");
    fireEvent.click(flagBadge);

    expect(screen.getByText(/experimentDataAnnotations.flags/)).toBeInTheDocument();
    expect(screen.getByText("This is an outlier")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
  });

  it("should show flag type badges in flags popover", () => {
    render(<ExperimentDataTableAnnotationsCell {...mockProps} />);

    const flagBadge = screen.getByText("2");
    fireEvent.click(flagBadge);

    // Check flag types are displayed - they appear as "experimentDataAnnotations.flagTypes.outlier" and "experimentDataAnnotations.flagTypes.needs_review"
    expect(screen.getByText("experimentDataAnnotations.flagTypes.outlier")).toBeInTheDocument();
    expect(
      screen.getByText("experimentDataAnnotations.flagTypes.needs_review"),
    ).toBeInTheDocument();
  });

  it("should call onAddAnnotation when add comment is clicked in comments popover", () => {
    render(<ExperimentDataTableAnnotationsCell {...mockProps} />);

    const commentBadge = screen.getByText("1");
    fireEvent.click(commentBadge);

    const addButton = screen.getAllByTitle(/experimentDataAnnotations.addComment/)[0];
    fireEvent.click(addButton);

    expect(mockProps.onAddAnnotation).toHaveBeenCalledWith(["row-123"], "comment");
  });

  it("should call onDeleteAnnotations when delete comments is clicked", () => {
    render(<ExperimentDataTableAnnotationsCell {...mockProps} />);

    const commentBadge = screen.getByText("1");
    fireEvent.click(commentBadge);

    const deleteButton = screen.getByTitle(
      /experimentDataAnnotations.bulkActions.removeAllComments/,
    );
    fireEvent.click(deleteButton);

    expect(mockProps.onDeleteAnnotations).toHaveBeenCalledWith(["row-123"], "comment");
  });

  it("should call onAddAnnotation when add flag is clicked in flags popover", () => {
    render(<ExperimentDataTableAnnotationsCell {...mockProps} />);

    const flagBadge = screen.getByText("2");
    fireEvent.click(flagBadge);

    const addButton = screen.getByTitle(/experimentDataAnnotations.addFlag/);
    fireEvent.click(addButton);

    expect(mockProps.onAddAnnotation).toHaveBeenCalledWith(["row-123"], "flag");
  });

  it("should call onDeleteAnnotations when delete flags is clicked", () => {
    render(<ExperimentDataTableAnnotationsCell {...mockProps} />);

    const flagBadge = screen.getByText("2");
    fireEvent.click(flagBadge);

    const deleteButton = screen.getByTitle(/experimentDataAnnotations.bulkActions.removeAllFlags/);
    fireEvent.click(deleteButton);

    expect(mockProps.onDeleteAnnotations).toHaveBeenCalledWith(["row-123"], "flag");
  });

  it("should handle empty annotations popover actions", () => {
    render(<ExperimentDataTableAnnotationsCell {...mockProps} data="[]" />);

    const addButton = screen.getByText(/common.add/);
    fireEvent.click(addButton);

    expect(screen.getByText(/experimentDataAnnotations.annotations/)).toBeInTheDocument();
    expect(screen.getByText("experimentDataAnnotations.noAnnotations")).toBeInTheDocument();
    expect(
      screen.getByText(/experimentDataAnnotations.noAnnotationsDescription/),
    ).toBeInTheDocument();
  });

  it("should call onAddAnnotation from empty state for comments", () => {
    render(<ExperimentDataTableAnnotationsCell {...mockProps} data="[]" />);

    const addButton = screen.getByText(/common.add/);
    fireEvent.click(addButton);

    const addCommentButton = screen.getByTitle(/experimentDataAnnotations.addComment/);
    fireEvent.click(addCommentButton);

    expect(mockProps.onAddAnnotation).toHaveBeenCalledWith(["row-123"], "comment");
  });

  it("should call onAddAnnotation from empty state for flags", () => {
    render(<ExperimentDataTableAnnotationsCell {...mockProps} data="[]" />);

    const addButton = screen.getByText(/common.add/);
    fireEvent.click(addButton);

    const addFlagButton = screen.getByTitle(/experimentDataAnnotations.addFlag/);
    fireEvent.click(addFlagButton);

    expect(mockProps.onAddAnnotation).toHaveBeenCalledWith(["row-123"], "flag");
  });

  it("should handle annotations without createdByName", () => {
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
    fireEvent.click(commentBadge);

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
});
