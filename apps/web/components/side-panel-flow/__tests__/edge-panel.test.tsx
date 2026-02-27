// apps/web/components/side-panel-flow/__tests__/edge-side-panel.test.tsx
import { render, screen, userEvent } from "@/test/test-utils";
import type { Edge } from "@xyflow/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { EdgeSidePanel } from "../edge-panel";

const makeEdge = (overrides?: Partial<Edge>): Edge =>
  ({
    id: "e1",
    source: "n1",
    target: "n2",
    data: { label: "init", extra: "x" } as Record<string, unknown>,
    ...overrides,
  }) as Edge;

describe("<EdgeSidePanel />", () => {
  it("shows and edits label from data.label; calls onEdgeUpdate; can delete", async () => {
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    const onClose = vi.fn();

    const edge = makeEdge();
    render(
      <EdgeSidePanel
        open
        selectedEdge={edge}
        onClose={onClose}
        onEdgeUpdate={onUpdate}
        onEdgeDelete={onDelete}
        isDisabled={false}
      />,
    );

    // Title and input visible
    expect(screen.getByText("edgePanel.settings")).toBeInTheDocument();
    const input = screen.getByPlaceholderText<HTMLInputElement>("edgePanel.labelPlaceholder");
    expect(input.value).toBe("init");

    const user = userEvent.setup();
    // Update label
    await user.clear(input);
    await user.type(input, "updated");
    expect(onUpdate).toHaveBeenCalledWith("e1", {
      data: { label: "updated", extra: "x" },
    });
    expect(input.value).toBe("updated"); // local state reflects change

    // Delete
    await user.click(screen.getByRole("button", { name: "edgePanel.remove" }));
    expect(onDelete).toHaveBeenCalledWith("e1");
    expect(onClose).toHaveBeenCalled();
  });

  it("falls back to edge.label when data.label is missing and updates via data.label", async () => {
    const onUpdate = vi.fn();
    const edge = makeEdge({
      data: { foo: "bar" } as Record<string, unknown>,
      label: "LBL",
    });

    render(
      <EdgeSidePanel
        open
        selectedEdge={edge}
        onClose={() => void 0}
        onEdgeUpdate={onUpdate}
        isDisabled={false}
      />,
    );

    const input = screen.getByPlaceholderText<HTMLInputElement>("edgePanel.labelPlaceholder");
    expect(input.value).toBe("LBL");

    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, "X");
    expect(onUpdate).toHaveBeenCalledWith("e1", {
      data: { foo: "bar", label: "X" },
    });
  });

  it("respects disabled state: controls are disabled; no update or delete", async () => {
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    const onClose = vi.fn();

    render(
      <EdgeSidePanel
        open
        selectedEdge={makeEdge()}
        onClose={onClose}
        onEdgeUpdate={onUpdate}
        onEdgeDelete={onDelete}
        isDisabled
      />,
    );

    const input = screen.getByPlaceholderText("edgePanel.labelPlaceholder");
    const removeBtn = screen.getByRole("button", { name: "edgePanel.remove" });

    expect(input).toBeDisabled();
    expect(removeBtn).toBeDisabled();

    const user = userEvent.setup();
    await user.type(input, "won't fire");
    await user.click(removeBtn);

    expect(onUpdate).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("backdrop click calls onClose", async () => {
    const onClose = vi.fn();
    render(<EdgeSidePanel open selectedEdge={makeEdge()} onClose={onClose} isDisabled={false} />);

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("edgePanel.closeBackdrop"));
    expect(onClose).toHaveBeenCalled();
  });
});
