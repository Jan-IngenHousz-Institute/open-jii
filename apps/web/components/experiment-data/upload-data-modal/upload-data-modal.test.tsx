import { createExperimentTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { UploadDataModal } from "./upload-data-modal";

function mountEmptyHistory() {
  server.mount(contract.experiments.listUploads, { body: { uploads: [] } });
}

function setExperimentTables(tables: ReturnType<typeof createExperimentTable>[] = []) {
  server.mount(contract.experiments.getExperimentTables, { body: tables });
}

function mountUploadCapture() {
  return server.mount(contract.experiments.uploadData, {
    body: {
      uploadId: "u-1",
      uploadTableId: "11111111-1111-1111-1111-111111111111",
      uploadTableName: "leaf_traits",
      runId: 99,
      files: [{ fileName: "data.csv", filePath: "/Volumes/x" }],
    },
    status: 201,
  });
}

async function selectFiles(
  filenames: string[],
  options?: { relativePath?: (i: number) => string },
) {
  // The modal binds a single file input; pick it by its accessible label.
  // Both the tabular and ambyte labels surface the same key suffix at runtime,
  // so the test uses the i18n key text directly.
  const input = screen.getByLabelText(/uploadDataModal\.files\./);
  const files = filenames.map((name, i) => {
    const f = new File(["content"], name, { type: "text/csv" });
    Object.defineProperty(f, "webkitRelativePath", {
      value: options?.relativePath?.(i) ?? "",
    });
    return f;
  });
  await userEvent.upload(input, files, { applyAccept: false });
}

describe("UploadDataModal", () => {
  it("renders title and description when open", () => {
    setExperimentTables();
    mountEmptyHistory();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    expect(screen.getByText("experimentData.uploadDataModal.title")).toBeInTheDocument();
    expect(screen.getByText("experimentData.uploadDataModal.description")).toBeInTheDocument();
  });

  it("posts a CSV upload with inferred fields when sourceKind defaults to csv", async () => {
    setExperimentTables();
    mountEmptyHistory();
    const spy = mountUploadCapture();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    await userEvent.type(
      screen.getByLabelText("experimentData.uploadDataModal.newTable.label"),
      "leaf_traits",
    );
    await selectFiles(["data.csv"]);
    await userEvent.click(
      screen.getByRole("button", { name: "experimentData.uploadDataModal.actions.upload" }),
    );

    await waitFor(() => {
      expect(spy.callCount).toBe(1);
    });
    const fd = spy.calls[0].body as FormData;
    expect(fd.get("sourceKind")).toBe("csv");
    expect(fd.get("targetKind")).toBe("new");
    expect(fd.get("targetName")).toBe("leaf_traits");
    expect(fd.getAll("files")).toHaveLength(1);
  });

  it("rejects mixed-format batches before they hit the wire", async () => {
    setExperimentTables();
    mountEmptyHistory();
    const spy = mountUploadCapture();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    await userEvent.type(
      screen.getByLabelText("experimentData.uploadDataModal.newTable.label"),
      "leaf_traits",
    );
    await selectFiles(["a.csv", "b.tsv"]);
    await userEvent.click(
      screen.getByRole("button", { name: "experimentData.uploadDataModal.actions.upload" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("experimentData.uploadDataModal.validation.mixedFormats"),
      ).toBeInTheDocument();
    });
    expect(spy.called).toBe(false);
  });

  it("defaults targetKind to 'existing' when an upload table already exists", async () => {
    setExperimentTables([
      createExperimentTable({
        identifier: "leaf_traits",
        tableType: "upload",
        displayName: "Leaf Traits",
        totalRows: 7,
      }),
    ]);
    mountEmptyHistory();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText("experimentData.uploadDataModal.existingTable.label"),
      ).toBeInTheDocument();
    });
  });

  it("blocks submit and surfaces the noFiles validation when no files are picked", async () => {
    setExperimentTables();
    mountEmptyHistory();
    const spy = mountUploadCapture();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    await userEvent.type(
      screen.getByLabelText("experimentData.uploadDataModal.newTable.label"),
      "leaf_traits",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "experimentData.uploadDataModal.actions.upload" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("experimentData.uploadDataModal.validation.noFiles"),
      ).toBeInTheDocument();
    });
    expect(spy.called).toBe(false);
  });

  it("rejects files whose extension isn't on the supported list", async () => {
    setExperimentTables();
    mountEmptyHistory();
    const spy = mountUploadCapture();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    await userEvent.type(
      screen.getByLabelText("experimentData.uploadDataModal.newTable.label"),
      "leaf_traits",
    );
    await selectFiles(["payload.bin"]);
    await userEvent.click(
      screen.getByRole("button", { name: "experimentData.uploadDataModal.actions.upload" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/uploadDataModal\.validation\.unsupportedFormat/),
      ).toBeInTheDocument();
    });
    expect(spy.called).toBe(false);
  });

  it("surfaces a submit error message when the upload request fails", async () => {
    setExperimentTables();
    mountEmptyHistory();
    server.mount(contract.experiments.uploadData, { status: 500 });

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    await userEvent.type(
      screen.getByLabelText("experimentData.uploadDataModal.newTable.label"),
      "leaf_traits",
    );
    await selectFiles(["data.csv"]);
    await userEvent.click(
      screen.getByRole("button", { name: "experimentData.uploadDataModal.actions.upload" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("experimentData.uploadDataModal.submitError.title"),
      ).toBeInTheDocument();
    });
  });

  it("invokes onOpenChange when the close button is clicked", async () => {
    setExperimentTables();
    mountEmptyHistory();
    const onOpenChange = vi.fn();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={onOpenChange} />);

    await userEvent.click(
      screen.getByRole("button", { name: "experimentData.uploadDataModal.actions.close" }),
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
