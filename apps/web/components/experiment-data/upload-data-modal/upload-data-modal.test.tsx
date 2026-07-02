import { createExperimentTable } from "@/test/factories";
import { API_URL } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { http, HttpResponse } from "msw";
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

// `uploadData` is a native multipart endpoint with no oRPC contract entry, so
// mount it by its literal route and capture the FormData body directly.
function mountUploadCapture(status = 201) {
  const calls: { body: FormData }[] = [];
  const spy = {
    calls,
    get called() {
      return calls.length > 0;
    },
    get callCount() {
      return calls.length;
    },
  };

  server.use(
    http.post(`${API_URL}/api/v1/experiments/:id/data/uploads`, async ({ request }) => {
      calls.push({ body: await request.formData() });

      if (status >= 400) {
        return HttpResponse.json({ message: "Error" }, { status });
      }

      return HttpResponse.json(
        {
          uploadId: "u-1",
          uploadTableId: "11111111-1111-1111-1111-111111111111",
          uploadTableName: "leaf_traits",
          runId: 99,
          files: [{ fileName: "data.csv", filePath: "/Volumes/x" }],
        },
        { status },
      );
    }),
  );

  return spy;
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
    const fd = spy.calls[0].body;
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

    await enterCreateView("csv");
    await userEvent.type(
      screen.getByLabelText("experimentData.uploadDataModal.newTable.label"),
      "leaf_traits",
    );
    await selectFiles(["a.csv", "b.tsv"]);
    await userEvent.click(
      screen.getByRole("button", { name: "experimentData.uploadDataModal.actions.upload" }),
    );

    await waitFor(() => {
      expect(screen.getByText(/validation\.mixedFormats/)).toBeInTheDocument();
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

    await enterCreateView("csv");

    await waitFor(() => {
      expect(
        screen.getByText("experimentData.uploadDataModal.existingTable.label"),
      ).toBeInTheDocument();
    });
  });

  it("hides the target picker and uses the folder label for ambyte uploads", async () => {
    setExperimentTables();
    mountEmptyHistory();

    render(<UploadDataModal experimentId="exp-1" open onOpenChange={vi.fn()} />);

    await enterCreateView("ambyte");

    expect(
      await screen.findByText("experimentData.uploadDataModal.files.dropzone.ambytePlaceholder"),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("experimentData.uploadDataModal.newTable.label"),
    ).not.toBeInTheDocument();
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
    mountUploadCapture(500);

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
