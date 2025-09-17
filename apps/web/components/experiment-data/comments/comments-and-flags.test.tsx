import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AddCommentDialogProps } from "~/components/experiment-data/comments/add-comment-dialog";
import { RenderCommentsAndFlags } from "~/components/experiment-data/comments/comments-and-flags";

import type { ExperimentDataComment } from "@repo/api";

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
        "common.add": "Add",
        "experimentDataComments.title": "Comments & Flags",
        "experimentDataComments.titleFlags": "Flags",
        "experimentDataComments.titleComments": "Comments",
        "experimentDataComments.noComments": "No comments or flags yet.",
        "experimentDataComments.noCommentsDescription": "Use the buttons above to add one.",
        "experimentDataComments.deleted.flag": "Flag deleted",
        "experimentDataComments.deleted.comment": "Comment deleted",
      };
      return translations[key] || key;
    },
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

// Mock AddCommentDialog
vi.mock("~/components/experiment-data/comments/add-comment-dialog", () => ({
  AddCommentDialog: ({ type }: AddCommentDialogProps) => (
    <div data-testid={`add-comment-dialog-${type}`}>AddCommentDialog</div>
  ),
}));

describe("RenderCommentsAndFlags", () => {
  const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) => children;
  };

  const comment1: ExperimentDataComment = {
    text: "Test comment 1",
    createdAt: "2025-09-01T00:00:00Z",
    createdBy: "user1",
    createdByName: "User One",
  };
  const comment2: ExperimentDataComment = {
    text: "Test comment 2",
    createdAt: "2025-09-02T00:00:00Z",
    createdBy: "user2",
    createdByName: "User Two",
  };
  const flag1: ExperimentDataComment = {
    text: "Flagged as outlier",
    createdAt: "2025-09-03T00:00:00Z",
    createdBy: "user3",
    createdByName: "User Three",
    flag: "outlier",
  };
  const flag2: ExperimentDataComment = {
    text: "Needs review",
    createdAt: "2025-09-04T00:00:00Z",
    createdBy: "user4",
    createdByName: "User Four",
    flag: "needs_review",
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
      <RenderCommentsAndFlags
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1"]}
        commentsJSON={"[]"}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("hover-card-trigger")).toBeInTheDocument();
    expect(screen.getByText("Add...")).toBeInTheDocument();
    expect(screen.getByText("Comments & Flags")).toBeInTheDocument();
    expect(screen.getByText("No comments or flags yet.")).toBeInTheDocument();
    expect(screen.getByText("Use the buttons above to add one.")).toBeInTheDocument();
    expect(screen.getByTestId("add-comment-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("add-comment-dialog-flag")).toBeInTheDocument();
  });

  it("should render a single comment", () => {
    const comments = [comment1];
    const commentsJSON = JSON.stringify(comments);
    render(
      <RenderCommentsAndFlags
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1"]}
        commentsJSON={commentsJSON}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId("hover-card-trigger")).toBeInTheDocument();
    expect(screen.getByText("Comments & Flags")).toBeInTheDocument();
    expect(screen.queryByText("No comments or flags yet.")).not.toBeInTheDocument();
    expect(screen.queryByText("Use the buttons above to add one.")).not.toBeInTheDocument();
    expect(screen.getByTestId("add-comment-dialog-comment")).toBeInTheDocument();
    expect(screen.getByTestId("add-comment-dialog-flag")).toBeInTheDocument();
    expect(screen.getByText("Test comment 1")).toBeInTheDocument();
  });

  it("should render multiple comments", () => {
    const commentsJSON = JSON.stringify([comment1, comment2]);
    render(
      <RenderCommentsAndFlags
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1"]}
        commentsJSON={commentsJSON}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText("Test comment 1")).toBeInTheDocument();
    expect(screen.getByText("Test comment 2")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toBeInTheDocument();
  });

  it("should render multiple flags", () => {
    const commentsJSON = JSON.stringify([flag1, flag2]);
    render(
      <RenderCommentsAndFlags
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1"]}
        commentsJSON={commentsJSON}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText("Flagged as outlier")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getAllByTestId("badge").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("FLAGS")).toBeInTheDocument();
  });

  it("should render mixed comments and flags", () => {
    const commentsJSON = JSON.stringify([comment1, flag1, comment2, flag2]);
    render(
      <RenderCommentsAndFlags
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1"]}
        commentsJSON={commentsJSON}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText("Test comment 1")).toBeInTheDocument();
    expect(screen.getByText("Test comment 2")).toBeInTheDocument();
    expect(screen.getByText("Flagged as outlier")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("COMMENTS")).toBeInTheDocument();
    expect(screen.getByText("FLAGS")).toBeInTheDocument();
  });

  it("should not render badge if there are no comments or flags", () => {
    render(
      <RenderCommentsAndFlags
        experimentId="exp1"
        tableName="table1"
        rowIds={["row1"]}
        commentsJSON={"[]"}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
  });
});
