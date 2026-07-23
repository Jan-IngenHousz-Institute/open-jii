import { createExperimentTable } from "@/test/factories";
import { render, screen, userEvent } from "@/test/test-utils";
import React from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { ExperimentUploadFormFields } from "@repo/api/domains/experiment/experiment.schema";

import { UploadTargetPicker } from "./upload-target-picker";

interface HarnessProps {
  defaults?: Partial<ExperimentUploadFormFields>;
  uploadTables?: ReturnType<typeof createExperimentTable>[];
  disabled?: boolean;
}

function Harness({ defaults, uploadTables = [], disabled = false }: HarnessProps) {
  const form = useForm<ExperimentUploadFormFields>({
    defaultValues: { targetKind: "new", sourceKind: "csv", targetName: "", ...defaults },
  });
  const targetKind = form.watch("targetKind");
  return (
    <UploadTargetPicker
      control={form.control}
      targetKind={targetKind}
      uploadTables={uploadTables}
      disabled={disabled}
    />
  );
}

describe("UploadTargetPicker", () => {
  it("renders the 'new' branch with a name input when targetKind=new", () => {
    render(<Harness />);
    expect(
      screen.getByLabelText("experimentData.uploadDataModal.newTable.label"),
    ).toBeInTheDocument();
  });

  it("renders the 'existing' branch when targetKind=existing and tables are available", () => {
    render(
      <Harness
        defaults={{
          targetKind: "existing",
          sourceKind: "csv",
          uploadTableId: "11111111-1111-1111-1111-111111111111",
        }}
        uploadTables={[
          createExperimentTable({
            identifier: "11111111-1111-1111-1111-111111111111",
            tableType: "upload",
            displayName: "Leaf Traits",
            totalRows: 12,
          }),
        ]}
      />,
    );

    expect(
      screen.getByText("experimentData.uploadDataModal.existingTable.label"),
    ).toBeInTheDocument();
  });

  it("disables the 'existing' radio option when no upload tables exist", () => {
    render(<Harness />);
    const existingRadio = screen.getByLabelText(
      "experimentData.uploadDataModal.targetKind.existing",
    );
    expect(existingRadio).toBeDisabled();
  });

  it("accepts typed input on the new-table name field", async () => {
    render(<Harness />);
    const input = screen.getByLabelText("experimentData.uploadDataModal.newTable.label");
    await userEvent.type(input, "leaf_traits");
    expect(input).toHaveValue("leaf_traits");
  });

  it("disables both inputs when disabled prop is true", () => {
    render(<Harness disabled />);
    expect(screen.getByLabelText("experimentData.uploadDataModal.newTable.label")).toBeDisabled();
  });
});
