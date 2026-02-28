import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import { ExperimentDescription } from "./experiment-description";

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

// ---------- Helpers ----------
function renderComponent(
  props: {
    experimentId?: string;
    description?: string;
    hasAccess?: boolean;
    isArchived?: boolean;
  } = {},
) {
  const defaultProps = {
    experimentId: props.experimentId ?? "exp-123",
    description: props.description ?? "Short description",
    hasAccess: props.hasAccess ?? false,
    isArchived: props.isArchived ?? false,
  };

  return render(<ExperimentDescription {...defaultProps} />);
}

describe("ExperimentDescription", () => {
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
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows expand button for long descriptions", () => {
    const longDescription = "a".repeat(800);
    renderComponent({ description: longDescription });
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("toggles between expand and collapse", async () => {
    const user = userEvent.setup();
    const longDescription = "a".repeat(800);
    renderComponent({ description: longDescription });

    const expandButton = screen.getByRole("button");
    await user.click(expandButton);
    expect(screen.getByRole("button")).toBeInTheDocument();

    await user.click(expandButton);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("enters edit mode when clicked with access and not archived", async () => {
    const user = userEvent.setup();
    renderComponent({ description: "Edit me", hasAccess: true, isArchived: false });

    const descriptionContainer = screen.getByTestId("rich-text-renderer").parentElement;
    if (descriptionContainer) {
      await user.click(descriptionContainer);
    }

    expect(screen.getByTestId("rich-textarea")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.cancel" })).toBeInTheDocument();
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

    const cancelButton = screen.getByRole("button", { name: "common.cancel" });
    await user.click(cancelButton);

    expect(screen.queryByTestId("rich-textarea")).not.toBeInTheDocument();
    expect(screen.getByText("Original text")).toBeInTheDocument();
  });

  it("saves description successfully", async () => {
    const spy = server.mount(contract.experiments.updateExperiment, {
      body: createExperiment({ id: "exp-456" }),
    });
    const user = userEvent.setup();
    renderComponent({ experimentId: "exp-456", description: "Old desc", hasAccess: true });

    const descriptionContainer = screen.getByTestId("rich-text-renderer").parentElement;
    if (descriptionContainer) {
      await user.click(descriptionContainer);
    }

    const textarea = screen.getByTestId("rich-textarea");
    await user.clear(textarea);
    await user.type(textarea, "New desc");

    const saveButton = screen.getByRole("button", { name: "common.save" });
    await user.click(saveButton);

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({ description: "New desc" });
    expect(spy.params).toMatchObject({ id: "exp-456" });
  });

  it("does not save if description unchanged", async () => {
    const spy = server.mount(contract.experiments.updateExperiment, {
      body: createExperiment(),
    });
    const user = userEvent.setup();
    renderComponent({ description: "Same text", hasAccess: true });

    const descriptionContainer = screen.getByTestId("rich-text-renderer").parentElement;
    if (descriptionContainer) {
      await user.click(descriptionContainer);
    }

    const saveButton = screen.getByRole("button", { name: "common.save" });
    await user.click(saveButton);

    expect(spy.called).toBe(false);
  });
});
