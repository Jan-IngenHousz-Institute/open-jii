import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ParallelCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { ParallelCellComponent } from "./parallel-cell";

vi.mock("../add-cell-button", () => ({ AddCellButton: () => null }));

function container(): ParallelCell {
  return {
    id: "container",
    type: "parallel",
    name: "device_lanes",
    defaultLaneId: "lane-a",
    isCollapsed: false,
    lanes: [
      {
        id: "lane-a",
        label: "First",
        color: "#005E5E",
        conditions: [],
        body: [
          {
            id: "command-a",
            type: "command",
            isCollapsed: false,
            payload: { format: "string", content: "battery", name: "Battery" },
          },
        ],
      },
      {
        id: "lane-b",
        label: "Second",
        color: "#6C5CE7",
        conditions: [],
        body: [],
      },
    ],
  };
}

describe("ParallelCellComponent", () => {
  it("reuses the shared condition editor for lane conditions", async () => {
    const cell = container();
    const onUpdate = vi.fn<(cell: ParallelCell) => void>();
    render(<ParallelCellComponent cell={cell} onUpdate={onUpdate} allCells={[cell]} />);

    await userEvent.click(screen.getAllByRole("button", { name: /condition/i })[0]);
    const updated = onUpdate.mock.calls[0][0];
    expect(updated.lanes[0].id).toBe("lane-a");
    expect(updated.lanes[0].conditions).toHaveLength(1);
    expect(updated.lanes[0].conditions[0]).toMatchObject({
      sourceCellId: "",
      field: "",
      operator: "eq",
    });
  });

  it("rehomes the exact default object when its lane is removed", async () => {
    const cell = container();
    const onUpdate = vi.fn<(cell: ParallelCell) => void>();
    render(<ParallelCellComponent cell={cell} onUpdate={onUpdate} allCells={[cell]} />);

    await userEvent.click(screen.getByRole("button", { name: "Remove First" }));
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultLaneId: "lane-b",
        lanes: [expect.objectContaining({ id: "lane-b" })],
      }),
    );
  });

  it("adds lanes with stable ids without disturbing a deliberate default", async () => {
    const cell = container();
    const onUpdate = vi.fn<(cell: ParallelCell) => void>();
    render(<ParallelCellComponent cell={cell} onUpdate={onUpdate} allCells={[cell]} />);

    await userEvent.click(screen.getByRole("button", { name: "Add lane" }));
    const update = onUpdate.mock.calls[0][0];
    expect(update.defaultLaneId).toBe("lane-a");
    expect(update.lanes).toHaveLength(3);
    expect(update.lanes[2]?.id).not.toBe("");
  });

  it("threads a pending lane question through the recursive cell renderer", async () => {
    const cell = container();
    cell.isCollapsed = true;
    cell.lanes[0].body = [
      {
        id: "lane-question",
        type: "question",
        name: "manual_reading",
        isCollapsed: false,
        isAnswered: false,
        question: { kind: "open_ended", text: "Enter the manual reading", required: true },
      },
    ];
    const onQuestionAnswered = vi.fn();
    render(
      <ParallelCellComponent
        cell={cell}
        onUpdate={vi.fn()}
        allCells={[cell]}
        promptedQuestionId="lane-question"
        onQuestionAnswered={onQuestionAnswered}
        executionStates={{ "lane-question": { status: "running" } }}
      />,
    );

    expect(screen.getByText("Enter the manual reading")).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText("Type your answer..."), "42");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(onQuestionAnswered).toHaveBeenCalledWith("42");
  });
});
