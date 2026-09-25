import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ColumnName } from "./column-name";

describe("ColumnName", () => {
  it("shows a column's name and no tag when it kept its name", () => {
    render(<ColumnName column={{ name: "phi2" }} />);

    expect(screen.getByText("phi2")).toBeInTheDocument();
    expect(screen.queryByText("dataColumns.sourceMacroOutput")).not.toBeInTheDocument();
  });

  it("shows a renamed field under its own name, tagged with its source", () => {
    render(
      <ColumnName
        column={{ name: "device_output", renamedFrom: { name: "device", source: "macro_output" } }}
      />,
    );

    expect(screen.getByText("device")).toBeInTheDocument();
    expect(screen.getByText("dataColumns.sourceMacroOutput")).toBeInTheDocument();
    expect(screen.queryByText("device_output")).not.toBeInTheDocument();
  });

  it("explains the rename, and the export name, on hover", async () => {
    render(
      <ColumnName
        column={{ name: "time_answer", renamedFrom: { name: "time", source: "questions_data" } }}
      />,
    );

    await userEvent.setup().hover(screen.getByText("dataColumns.sourceQuestion"));

    expect((await screen.findAllByText("dataColumns.renamedTooltip")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("dataColumns.renamedExportName").length).toBeGreaterThan(0);
  });

  it("leaves the export name out for a source exports keep as one column", async () => {
    render(
      <ColumnName
        column={{ name: "ID_metadata", renamedFrom: { name: "ID", source: "custom_metadata" } }}
      />,
    );

    await userEvent.setup().hover(screen.getByText("dataColumns.sourceMetadata"));

    expect((await screen.findAllByText("dataColumns.renamedTooltip")).length).toBeGreaterThan(0);
    expect(screen.queryByText("dataColumns.renamedExportName")).not.toBeInTheDocument();
  });
});
