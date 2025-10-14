import { render, screen } from "@testing-library/react";
import React from "react";
import { v4 as uuidv4 } from "uuid";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AddAnnotationDialogProps } from "~/components/experiment-data/annotations/add-annotation-dialog";
import { Annotations } from "~/components/experiment-data/annotations/annotations";
import { getAnnotationData } from "~/components/experiment-data/annotations/utils";

import type { Annotation } from "@repo/api";

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="badge">{children ?? "Badge"}</div>
  ),
  Button: ({ className }: { className?: string }) => (
    <div data-testid="button" className={className} />
  ),
  HoverCard: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="hover-card">{children ?? "HoverCard"}</div>
  ),
  HoverCardContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="hover-card-content">{children ?? "HoverCardContent"}</div>
  ),
  HoverCardTrigger: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="hover-card-trigger">{children ?? "HoverCardTrigger"}</div>
  ),
}));

// Mock AddAnnotationDialog
vi.mock("~/components/experiment-data/annotations/add-annotation-dialog", () => ({
  AddAnnotationDialog: ({ type }: AddAnnotationDialogProps) => (
    <div data-testid={`add-annotation-dialog-${type}`}>AddAnnotationDialog</div>
  ),
}));

describe("Annotations", () => {
  const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) => children;
  };

  const comment1: Annotation = {
    id: uuidv4(),
    userId: uuidv4(),
    userName: "User One",
    type: "comment",
    content: { text: "Test comment 1" },
    createdAt: "2025-09-01T00:00:00Z",
    updatedAt: "2025-09-01T00:00:00Z",
  };

  const comment2: Annotation = {
    id: uuidv4(),
    userId: uuidv4(),
    userName: "User Two",
    type: "comment",
    content: { text: "Test comment 2" },
    createdAt: "2025-09-02T00:00:00Z",
    updatedAt: "2025-09-02T00:00:00Z",
  };

  const flag1: Annotation = {
    id: uuidv4(),
    userId: uuidv4(),
    userName: "User Three",
    type: "flag",
    content: { flagType: "outlier", reason: "Flagged as outlier" },
    createdAt: "2025-09-03T00:00:00Z",
    updatedAt: "2025-09-03T00:00:00Z",
  };

  const flag2: Annotation = {
    id: uuidv4(),
    userId: uuidv4(),
    userName: "User Four",
    type: "flag",
    content: { flagType: "needs_review", reason: "Needs review" },
    createdAt: "2025-09-04T00:00:00Z",
    updatedAt: "2025-09-04T00:00:00Z",
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

  it("should render an empty list", () => {
    render(
      <Annotations
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1"]}
        data={getAnnotationData([])}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("hover-card-trigger")).toBeInTheDocument();
    expect(screen.getByText("common.add...")).toBeInTheDocument();
    expect(screen.getByText("experimentDataAnnotations.title")).toBeInTheDocument();
    expect(screen.getByText("experimentDataAnnotations.noAnnotations")).toBeInTheDocument();
    expect(
      screen.getByText("experimentDataAnnotations.noAnnotationsDescription"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("add-annotation-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("add-annotation-dialog-flag")).toBeInTheDocument();
  });

  it("should render a single comment", () => {
    render(
      <Annotations
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1"]}
        data={getAnnotationData([comment1])}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId("hover-card-trigger")).toBeInTheDocument();
    expect(screen.getByText("experimentDataAnnotations.title")).toBeInTheDocument();
    expect(screen.queryByText("experimentDataAnnotations.noAnnotations")).not.toBeInTheDocument();
    expect(
      screen.queryByText("experimentDataAnnotations.noAnnotationsDescription"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("add-annotation-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("add-annotation-dialog-flag")).toBeInTheDocument();
    expect(screen.getByText("experimentDataAnnotations.titleComments")).toBeInTheDocument();
    expect(screen.getByText("Test comment 1")).toBeInTheDocument();
  });

  it("should render multiple comments", () => {
    render(
      <Annotations
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1"]}
        data={getAnnotationData([comment1, comment2])}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText("experimentDataAnnotations.title")).toBeInTheDocument();
    expect(screen.getByText("Test comment 1")).toBeInTheDocument();
    expect(screen.getByText("Test comment 2")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toBeInTheDocument();
  });

  it("should render multiple flags", () => {
    render(
      <Annotations
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1"]}
        data={getAnnotationData([flag1, flag2])}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText("Flagged as outlier")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getAllByTestId("badge").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("experimentDataAnnotations.titleFlags")).toBeInTheDocument();
  });

  it("should render mixed comments and flags", () => {
    render(
      <Annotations
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1"]}
        data={getAnnotationData([comment1, flag1, comment2, flag2])}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText("Test comment 1")).toBeInTheDocument();
    expect(screen.getByText("Test comment 2")).toBeInTheDocument();
    expect(screen.getByText("Flagged as outlier")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("experimentDataAnnotations.titleComments")).toBeInTheDocument();
    expect(screen.getByText("experimentDataAnnotations.titleFlags")).toBeInTheDocument();
  });

  it("should not render badge if there are no comments or flags", () => {
    render(
      <Annotations
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1"]}
        data={getAnnotationData([])}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
  });
});
