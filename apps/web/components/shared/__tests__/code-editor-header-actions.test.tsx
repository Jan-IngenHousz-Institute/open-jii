import type { AutosaveStatus } from "@/hooks/useAutosave";
import { render, screen, userEvent, fireEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { CodeEditorHeaderActions } from "../code-editor-header-actions";

function renderComponent(status: AutosaveStatus, onClose = vi.fn()) {
  return {
    onClose,
    ...render(<CodeEditorHeaderActions status={status} onClose={onClose} />),
  };
}

describe("CodeEditorHeaderActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the saved-state check icon when status is idle", () => {
    renderComponent("idle");
    expect(document.querySelector(".lucide-circle-check")).toBeInTheDocument();
    expect(document.querySelector(".lucide-loader-circle")).not.toBeInTheDocument();
  });

  it("renders the dirty-state amber circle when status is dirty", () => {
    renderComponent("dirty");
    // Plain Circle (no inner check). Filtering by class avoids matching
    // the destructive AlertCircle / CheckCircle2 variants.
    const dot = document.querySelector(".lucide-circle.fill-amber-500");
    expect(dot).toBeInTheDocument();
  });

  it("renders the spinner when status is saving", () => {
    renderComponent("saving");
    expect(document.querySelector(".lucide-loader-circle")).toBeInTheDocument();
    expect(document.querySelector(".lucide-circle-check")).not.toBeInTheDocument();
  });

  it("renders the destructive alert when status is error", () => {
    renderComponent("error");
    expect(document.querySelector(".lucide-circle-alert")).toBeInTheDocument();
  });

  it("uses the saved label as the aria-label / tooltip when idle", () => {
    renderComponent("idle");
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "autosave.saved");
    fireEvent.focus(status);
    expect(screen.getByRole("tooltip")).toHaveTextContent("autosave.saved");
  });

  it("uses the dirty label when there are unsaved changes", () => {
    renderComponent("dirty");
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "autosave.dirty");
  });

  it("uses the saving label while a save is in flight", () => {
    renderComponent("saving");
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "autosave.saving");
  });

  it("uses the failed label on error", () => {
    renderComponent("error");
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "autosave.failed");
  });

  it("shows 'Close editor' tooltip for the close button", () => {
    renderComponent("idle");
    const closeButton = screen.getByRole("button");
    fireEvent.focus(closeButton);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Close editor");
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderComponent("idle", onClose);

    await user.click(screen.getByRole("button"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
