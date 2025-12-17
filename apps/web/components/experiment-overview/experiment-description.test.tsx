import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ExperimentDescription } from "./experiment-description";

globalThis.React = React;

// ---------- Mocks ----------
const mutateAsyncMock = vi.fn();

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
}));

vi.mock("@/hooks/experiment/useExperimentUpdate/useExperimentUpdate", () => ({
  useExperimentUpdate: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

vi.mock("@repo/ui/components", async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    RichTextarea: ({
      value,
      onChange,
      placeholder,
      isDisabled,
    }: {
      value: string;
      onChange: (val: string) => void;
      placeholder: string;
      isDisabled: boolean;
    }) => (
      <textarea
        data-testid="rich-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={isDisabled}
      />
    ),
    RichTextRenderer: ({ content }: { content: string }) => (
      <div data-testid="rich-text-renderer">{content}</div>
    ),
  };
});

vi.mock("lucide-react", () => ({
  Check: () => <span data-testid="icon-check">Check</span>,
  X: () => <span data-testid="icon-x">X</span>,
  ChevronDown: () => <span data-testid="icon-chevron-down">ChevronDown</span>,
  ChevronUp: () => <span data-testid="icon-chevron-up">ChevronUp</span>,
}));

// ---------- Helpers ----------
function renderComponent(
  props: {
    experimentId?: string;
    description?: string;
    hasAccess?: boolean;
    isArchived?: boolean;
  } = {},
) {
  const queryClient = new QueryClient();
  const defaultProps = {
    experimentId: props.experimentId ?? "exp-123",
    description: props.description ?? "Short description",
    hasAccess: props.hasAccess ?? false,
    isArchived: props.isArchived ?? false,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <ExperimentDescription {...defaultProps} />
    </QueryClientProvider>,
  );
}

describe("ExperimentDescription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders description text", () => {
    renderComponent({ description: "Test description" });
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("renders title", () => {
    renderComponent();
    expect(screen.getByText("descriptionTitle")).toBeInTheDocument();
  });

  it("does not show expand button for short descriptions", () => {
    renderComponent({ description: "Short text" });
    expect(screen.queryByTestId("icon-chevron-down")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-chevron-up")).not.toBeInTheDocument();
  });

  it("shows expand button for long descriptions", () => {
    const longDescription = "a".repeat(800);
    renderComponent({ description: longDescription });
    expect(screen.getByTestId("icon-chevron-down")).toBeInTheDocument();
  });

  it("toggles between expand and collapse", async () => {
    const user = userEvent.setup();
    const longDescription = "a".repeat(800);
    renderComponent({ description: longDescription });

    const expandButton = screen.getByRole("button");
    expect(screen.getByTestId("icon-chevron-down")).toBeInTheDocument();

    await user.click(expandButton);
    expect(screen.getByTestId("icon-chevron-up")).toBeInTheDocument();

    await user.click(expandButton);
    expect(screen.getByTestId("icon-chevron-down")).toBeInTheDocument();
  });

  it("enters edit mode when clicked with access and not archived", async () => {
    const user = userEvent.setup();
    renderComponent({ description: "Edit me", hasAccess: true, isArchived: false });

    const descriptionContainer = screen.getByTestId("rich-text-renderer").parentElement;
    if (descriptionContainer) {
      await user.click(descriptionContainer);
    }

    expect(screen.getByTestId("rich-textarea")).toBeInTheDocument();
    expect(screen.getByTestId("icon-check")).toBeInTheDocument();
    expect(screen.getByTestId("icon-x")).toBeInTheDocument();
  });

  it("does not enter edit mode when archived", async () => {
    const user = userEvent.setup();
    renderComponent({ description: "No edit", hasAccess: true, isArchived: true });

    const descriptionContainer = screen.getByTestId("rich-text-renderer").parentElement;
    if (descriptionContainer) {
      await user.click(descriptionContainer);
    }

    expect(screen.queryByTestId("rich-textarea")).not.toBeInTheDocument();
  });

  it("does not enter edit mode without access", async () => {
    const user = userEvent.setup();
    renderComponent({ description: "No edit", hasAccess: false, isArchived: false });

    const descriptionContainer = screen.getByTestId("rich-text-renderer").parentElement;
    if (descriptionContainer) {
      await user.click(descriptionContainer);
    }

    expect(screen.queryByTestId("rich-textarea")).not.toBeInTheDocument();
  });

  it("cancels edit mode and resets text", async () => {
    const user = userEvent.setup();
    renderComponent({ description: "Original text", hasAccess: true });

    const descriptionContainer = screen.getByTestId("rich-text-renderer").parentElement;
    if (descriptionContainer) {
      await user.click(descriptionContainer);
    }

    const textarea = screen.getByTestId("rich-textarea");
    await user.clear(textarea);
    await user.type(textarea, "Changed text");

    const cancelButton = screen.getByTestId("icon-x");
    await user.click(cancelButton);

    expect(screen.queryByTestId("rich-textarea")).not.toBeInTheDocument();
    expect(screen.getByText("Original text")).toBeInTheDocument();
  });

  it("saves description successfully", async () => {
    const user = userEvent.setup();
    renderComponent({ experimentId: "exp-456", description: "Old desc", hasAccess: true });

    const descriptionContainer = screen.getByTestId("rich-text-renderer").parentElement;
    if (descriptionContainer) {
      await user.click(descriptionContainer);
    }

    const textarea = screen.getByTestId("rich-textarea");
    await user.clear(textarea);
    await user.type(textarea, "New desc");

    const saveButton = screen.getByTestId("icon-check");
    await user.click(saveButton);

    expect(mutateAsyncMock).toHaveBeenCalledWith(
      {
        params: { id: "exp-456" },
        body: { description: "New desc" },
      },
      expect.objectContaining({
        onSuccess: expect.any(Function) as unknown,
        onError: expect.any(Function) as unknown,
        onSettled: expect.any(Function) as unknown,
      }),
    );
  });

  it("does not save if description unchanged", async () => {
    const user = userEvent.setup();
    renderComponent({ description: "Same text", hasAccess: true });

    const descriptionContainer = screen.getByTestId("rich-text-renderer").parentElement;
    if (descriptionContainer) {
      await user.click(descriptionContainer);
    }

    const saveButton = screen.getByTestId("icon-check");
    await user.click(saveButton);

    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });
});
