import { render, screen, userEvent, fireEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { CodeEditorHeaderActions } from "../code-editor-header-actions";

// ---------- Helpers ----------
type SyncStatus = "synced" | "unsynced" | "syncing";

function renderComponent(syncStatus: SyncStatus, onClose = vi.fn()) {
  return {
    onClose,
    ...render(<CodeEditorHeaderActions syncStatus={syncStatus} onClose={onClose} />),
  };
}

// ---------- Tests ----------
describe("CodeEditorHeaderActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- Icon rendering ----------
  it("renders check icon when syncStatus is synced", () => {
    renderComponent("synced");
    expect(document.querySelector(".lucide-check")).toBeInTheDocument();
    expect(document.querySelector(".lucide-circle")).not.toBeInTheDocument();
    expect(document.querySelector(".lucide-loader-circle")).not.toBeInTheDocument();
  });

  it("renders circle icon when syncStatus is unsynced", () => {
    renderComponent("unsynced");
    expect(document.querySelector(".lucide-circle")).toBeInTheDocument();
    expect(document.querySelector(".lucide-check")).not.toBeInTheDocument();
    expect(document.querySelector(".lucide-loader-circle")).not.toBeInTheDocument();
  });

  it("renders loader icon when syncStatus is syncing", () => {
    renderComponent("syncing");
    expect(document.querySelector(".lucide-loader-circle")).toBeInTheDocument();
    expect(document.querySelector(".lucide-check")).not.toBeInTheDocument();
    expect(document.querySelector(".lucide-circle")).not.toBeInTheDocument();
  });

  // ---------- Tooltip text ----------
  it("shows 'All changes saved' tooltip for synced", () => {
    renderComponent("synced");
    const trigger = document.querySelector(".lucide-check")!.closest("span")!;
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("All changes saved");
  });

  it("shows 'Unsaved changes' tooltip for unsynced", () => {
    renderComponent("unsynced");
    const trigger = document.querySelector(".lucide-circle")!.closest("span")!;
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Unsaved changes");
  });

  it("shows 'Saving...' tooltip for syncing", () => {
    renderComponent("syncing");
    const trigger = document.querySelector(".lucide-loader-circle")!.closest("span")!;
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Saving...");
  });

  it("shows 'Close editor' tooltip for close button", () => {
    renderComponent("synced");
    const closeButton = screen.getByRole("button");
    fireEvent.focus(closeButton);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Close editor");
  });

  // ---------- Close button ----------
  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderComponent("synced", onClose);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
