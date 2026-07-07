import { createExperimentTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, fireEvent } from "@/test/test-utils";
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

// The list view is the default; the form lives behind the "New upload" dropdown.
async function enterCreateView(kind = "csv") {
  await userEvent.click(
    screen.getByRole("button", { name: "experimentData.uploadDataModal.actions.newUpload" }),
  );
  await userEvent.click(
    await screen.findByRole("menuitem", {
      name: `experimentData.uploadDataModal.history.sourceKind.${kind}`,
    }),
  );
}

async function selectFiles(
  filenames: string[],
  options?: { relativePath?: (i: number) => string },
) {
  // The dropzone's file input is hidden and unlabeled; there's one per modal.
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("file input not found");
  }
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

  it("opens the create form from the New upload dropdown", async () => {
    setExperimentTables();
    mountEmptyHistory();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    await enterCreateView("csv");

    expect(
      await screen.findByLabelText("experimentData.uploadDataModal.newTable.label"),
    ).toBeInTheDocument();
  });

  it("posts a CSV upload with the dropdown-selected source kind", async () => {
    setExperimentTables();
    mountEmptyHistory();
    const spy = mountUploadCapture();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    await enterCreateView("csv");
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

  it("flags a file that doesn't match the selected format on selection (before Upload)", async () => {
    setExperimentTables();
    mountEmptyHistory();
    const spy = mountUploadCapture();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    await enterCreateView("csv");
    // A .tsv file when CSV was chosen: error must surface without clicking Upload.
    await selectFiles(["data.tsv"]);

    await waitFor(() => {
      expect(screen.getByText(/validation\.wrongFormat/)).toBeInTheDocument();
    });
    expect(spy.called).toBe(false);
  });

  it("clears the file error when the selection is emptied", async () => {
    setExperimentTables();
    mountEmptyHistory();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    await enterCreateView("csv");
    await selectFiles(["data.tsv"]);
    await waitFor(() => {
      expect(screen.getByText(/validation\.wrongFormat/)).toBeInTheDocument();
    });

    // Emptying the picker clears the error.
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("file input not found");
    }
    fireEvent.change(input, { target: { files: [] } });

    await waitFor(() => {
      expect(screen.queryByText(/validation\.wrongFormat/)).not.toBeInTheDocument();
    });
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

    await enterCreateView("csv");

    await waitFor(() => {
      expect(
        screen.getByText("experimentData.uploadDataModal.existingTable.label"),
      ).toBeInTheDocument();
    });
  });

  it("shows a validation error when appending with no table selected", async () => {
    setExperimentTables([
      createExperimentTable({
        identifier: "leaf_traits",
        tableType: "upload",
        displayName: "Leaf Traits",
        totalRows: 7,
      }),
    ]);
    mountEmptyHistory();
    const spy = mountUploadCapture();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    await enterCreateView("csv");
    // Defaults to "append to existing" with no table picked; Upload must surface an error.
    await waitFor(() => {
      expect(
        screen.getByText("experimentData.uploadDataModal.existingTable.label"),
      ).toBeInTheDocument();
    });
    await userEvent.click(
      screen.getByRole("button", { name: "experimentData.uploadDataModal.actions.upload" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Select a table to append to")).toBeInTheDocument();
    });
    expect(spy.called).toBe(false);
  });

  it("uses the same target form and a folder dropzone for ambyte uploads", async () => {
    setExperimentTables();
    mountEmptyHistory();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    await enterCreateView("ambyte");

    // Ambyte is just another format now: same create-new + name target form...
    expect(
      await screen.findByLabelText("experimentData.uploadDataModal.newTable.label"),
    ).toBeInTheDocument();
    // ...but it keeps the folder dropzone.
    expect(
      screen.getByText("experimentData.uploadDataModal.files.dropzone.ambytePlaceholder"),
    ).toBeInTheDocument();
  });

  it("blocks submit and surfaces the noFiles validation when no files are picked", async () => {
    setExperimentTables();
    mountEmptyHistory();
    const spy = mountUploadCapture();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    await enterCreateView("csv");
    await userEvent.type(
      screen.getByLabelText("experimentData.uploadDataModal.newTable.label"),
      "leaf_traits",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "experimentData.uploadDataModal.actions.upload" }),
    );

    await waitFor(() => {
      expect(screen.getByText(/validation\.noFiles/)).toBeInTheDocument();
    });
    expect(spy.called).toBe(false);
  });

  it("rejects files whose extension isn't on the supported list", async () => {
    setExperimentTables();
    mountEmptyHistory();
    const spy = mountUploadCapture();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    await enterCreateView("csv");
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

    await enterCreateView("csv");
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

  it("returns to the list view via Back without uploading", async () => {
    setExperimentTables();
    mountEmptyHistory();
    const spy = mountUploadCapture();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    await enterCreateView("csv");
    await userEvent.click(
      screen.getByRole("button", { name: "experimentData.uploadDataModal.actions.back" }),
    );

    expect(
      screen.getByRole("button", { name: "experimentData.uploadDataModal.actions.newUpload" }),
    ).toBeInTheDocument();
    expect(spy.called).toBe(false);
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
