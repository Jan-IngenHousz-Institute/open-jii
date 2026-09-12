import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { ExperimentTableMetadata } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { DatasetPicker } from "./dataset-picker";

function table(overrides: Partial<ExperimentTableMetadata> = {}): ExperimentTableMetadata {
  return {
    identifier: "raw_data",
    tableType: "static",
    displayName: "Raw Data",
    totalRows: 122840,
    ...overrides,
  };
}

const TABLES: ExperimentTableMetadata[] = [
  table(),
  table({ identifier: "device", displayName: "Device Metadata", totalRows: 2 }),
  table({
    identifier: "macro-1",
    tableType: "macro",
    displayName: "Processed Data (ambyte-trace)",
    totalRows: 12268,
  }),
  table({
    identifier: "upload-1",
    tableType: "upload",
    displayName: "Field notes",
    totalRows: 7,
  }),
];

describe("DatasetPicker", () => {
  it("shows the selected dataset and its row count on the trigger", () => {
    render(<DatasetPicker tables={TABLES} value="raw_data" onChange={vi.fn()} />);

    const trigger = screen.getByRole("combobox", { name: "experimentData.datasetLabel" });
    expect(trigger).toHaveTextContent("Raw Data");
    expect(trigger).toHaveTextContent("experimentData.datasetRows");
  });

  it("groups datasets by where they came from", async () => {
    const user = userEvent.setup();
    render(<DatasetPicker tables={TABLES} value="raw_data" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    // Document order: presence alone cannot tell grouping from a flat list.
    const order = [
      "experimentData.datasetGroupStatic",
      "experimentData.datasetGroupMacro",
      "experimentData.datasetGroupUpload",
    ];
    await screen.findByText(order[0]);

    const rendered = order.map((heading) => screen.getByText(heading));
    for (let i = 1; i < rendered.length; i += 1) {
      expect(
        rendered[i - 1].compareDocumentPosition(rendered[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("formats row counts for the locale rather than printing the raw integer", async () => {
    const user = userEvent.setup();
    render(<DatasetPicker tables={TABLES} value="raw_data" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    // en-US here, so a comma; the point is that a separator is applied at all.
    expect(await screen.findByRole("option", { name: /Raw Data/ })).toHaveTextContent("122,840");
  });

  it("reports the picked dataset", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatasetPicker tables={TABLES} value="raw_data" onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /Field notes/ }));

    expect(onChange).toHaveBeenCalledWith("upload-1");
  });

  it("omits a group nothing belongs to", async () => {
    const user = userEvent.setup();
    render(<DatasetPicker tables={[table()]} value="raw_data" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByText("experimentData.datasetGroupStatic")).toBeInTheDocument();
    expect(screen.queryByText("experimentData.datasetGroupMacro")).not.toBeInTheDocument();
    expect(screen.queryByText("experimentData.datasetGroupUpload")).not.toBeInTheDocument();
  });
});
