import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { WorkbookCanvasModebar } from "../workbook-canvas-modebar";

vi.mock("../../workbook/protocol-picker", () => ({
  ProtocolPicker: ({
    onSelect,
    children,
  }: {
    onSelect: (cell: unknown) => void;
    children: React.ReactNode;
  }) => (
    <div>
      {children}
      <button
        type="button"
        onClick={() =>
          onSelect({
            id: "protocol",
            type: "protocol",
            isCollapsed: false,
            payload: {
              protocolId: "11111111-1111-1111-1111-111111111111",
              version: 4,
            },
          })
        }
      >
        Choose protocol
      </button>
    </div>
  ),
}));

vi.mock("../../workbook/macro-picker", () => ({
  MacroPicker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../workbook/question-picker", () => ({
  QuestionPicker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("WorkbookCanvasModebar", () => {
  it("arms a fully valid picker-created protocol cell", async () => {
    const onArmCell = vi.fn();
    render(
      <WorkbookCanvasModebar
        visible
        existingCells={[]}
        pendingCell={null}
        onArmCell={onArmCell}
        onCursor={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Place protocol" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Choose protocol" }));
    expect(onArmCell).toHaveBeenCalledWith({
      id: "protocol",
      type: "protocol",
      isCollapsed: false,
      payload: {
        protocolId: "11111111-1111-1111-1111-111111111111",
        version: 4,
      },
    });
  });
});
