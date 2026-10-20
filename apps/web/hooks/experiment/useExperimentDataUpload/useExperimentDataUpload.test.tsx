import { useActivity } from "@/components/activity/activity-context";
import { API_URL } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useListUploads } from "~/hooks/experiment/useListUploads/useListUploads";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { useExperimentDataUpload } from "./useExperimentDataUpload";

const UPLOAD_ID = "8c1f6a0e-4c35-4d7e-9a43-3f0b2a5d1e77";

function respondToUpload(status: number) {
  server.use(
    http.post(`${API_URL}/api/v1/experiments/:id/data/uploads`, () =>
      status >= 400
        ? HttpResponse.json({ message: "boom" }, { status })
        : HttpResponse.json({ uploadId: UPLOAD_ID, files: [] }, { status }),
    ),
  );
}

// A mounted list query, so the test sees what an invalidation actually refetches.
function useUploadWithList() {
  return {
    upload: useExperimentDataUpload(),
    list: useListUploads("exp-1", { enabled: true }),
  };
}

function buildFormData() {
  const fd = new FormData();
  fd.append("sourceKind", "csv");
  fd.append("targetKind", "new");
  fd.append("targetName", "leaf_traits");
  fd.append("files", new File(["x"], "data.csv", { type: "text/csv" }));
  return fd;
}

function makeFile(name: string, options?: { relativePath?: string; size?: number }): File {
  const file = new File(["x"], name, { type: "text/csv" });
  // jsdom's File doesn't expose webkitRelativePath; production reads it always.
  Object.defineProperty(file, "webkitRelativePath", { value: options?.relativePath ?? "" });
  if (options?.size !== undefined) {
    Object.defineProperty(file, "size", { value: options.size });
  }
  return file;
}

function makeFileList(files: File[]): FileList {
  return Object.assign(files, {
    item: (i: number) => files[i] ?? null,
  });
}

describe("useExperimentDataUpload (mutation)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // uploadData is a native streaming endpoint posted via a raw fetch (off the
  // oRPC contract), so the request is asserted against the mocked global fetch.
  it("posts a multipart upload to the generic uploads endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          uploadId: UPLOAD_ID,
          files: [{ fileName: "data.csv", filePath: "/x/y" }],
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );

    const { result } = renderHook(() => useExperimentDataUpload());

    act(() => {
      result.current.mutate({
        params: { id: "exp-1" },
        body: buildFormData(),
        uploadId: UPLOAD_ID,
        label: "Leaf traits",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/experiments/exp-1/data/uploads"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toBeInstanceOf(FormData);
    expect(result.current.data).toEqual({
      uploadId: UPLOAD_ID,
      files: [{ fileName: "data.csv", filePath: "/x/y" }],
    });
  });

  it("fails the transfer when the response does not match the upload contract", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    const { result } = renderHook(() => ({
      upload: useExperimentDataUpload(),
      activity: useActivity(),
    }));

    act(() => {
      result.current.upload.mutate({
        params: { id: "exp-1" },
        body: buildFormData(),
        uploadId: UPLOAD_ID,
        label: "Leaf traits",
      });
    });

    await waitFor(() => {
      expect(result.current.upload.isError).toBe(true);
    });
    expect(result.current.activity.entries[0]).toMatchObject({ id: UPLOAD_ID, status: "failed" });
  });

  it("refetches the experiment's upload list once the transfer is received", async () => {
    const listSpy = server.mount(contract.experiments.listUploads, { body: { uploads: [] } });
    respondToUpload(201);

    const { result } = renderHook(() => useUploadWithList());
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });
    expect(listSpy.callCount).toBe(1);

    act(() => {
      result.current.upload.mutate({
        params: { id: "exp-1" },
        body: buildFormData(),
        uploadId: UPLOAD_ID,
        label: "Leaf traits",
      });
    });

    await waitFor(() => {
      expect(result.current.upload.isSuccess).toBe(true);
    });
    expect(listSpy.callCount).toBe(2);
  });

  it("leaves the upload list alone when the transfer fails", async () => {
    const listSpy = server.mount(contract.experiments.listUploads, { body: { uploads: [] } });
    respondToUpload(500);

    const { result } = renderHook(() => useUploadWithList());
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });

    act(() => {
      result.current.upload.mutate({
        params: { id: "exp-1" },
        body: buildFormData(),
        uploadId: UPLOAD_ID,
        label: "Leaf traits",
      });
    });

    await waitFor(() => {
      expect(result.current.upload.isError).toBe(true);
    });
    expect(listSpy.callCount).toBe(1);
  });

  it("surfaces a failed response on the mutation result", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "boom" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useExperimentDataUpload());

    act(() => {
      result.current.mutate({
        params: { id: "exp-1" },
        body: buildFormData(),
        uploadId: UPLOAD_ID,
        label: "Leaf traits",
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("tracks the transfer while it runs and announces when it is received", async () => {
    let respond: (response: Response) => void = () => undefined;
    vi.spyOn(globalThis, "fetch").mockReturnValue(
      new Promise<Response>((resolve) => {
        respond = resolve;
      }),
    );

    const { result } = renderHook(() => ({
      upload: useExperimentDataUpload(),
      activity: useActivity(),
    }));

    act(() => {
      result.current.upload.mutate({
        params: { id: "exp-1" },
        body: buildFormData(),
        uploadId: UPLOAD_ID,
        label: "Leaf traits",
      });
    });

    await waitFor(() => {
      expect(result.current.activity.entries).toEqual([
        expect.objectContaining({
          kind: "data_upload",
          title: "Leaf traits",
          status: "running",
          experimentId: "exp-1",
        }),
      ]);
    });
    expect(toast).toHaveBeenCalledWith({
      description: "experimentData.uploadDataModal.transfer.started",
    });

    act(() => {
      respond(
        new Response(JSON.stringify({ uploadId: UPLOAD_ID, files: [] }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.activity.entries[0]).toMatchObject({
        id: UPLOAD_ID,
        status: "succeeded",
      });
    });
    expect(toast).toHaveBeenLastCalledWith({
      description: "experimentData.uploadDataModal.transfer.received",
    });
  });

  it("marks the transfer failed and shows the error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Too many files in upload" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    const { result } = renderHook(() => ({
      upload: useExperimentDataUpload(),
      activity: useActivity(),
    }));

    act(() => {
      result.current.upload.mutate({
        params: { id: "exp-1" },
        body: buildFormData(),
        uploadId: UPLOAD_ID,
        label: "Leaf traits",
      });
    });

    await waitFor(() => {
      expect(result.current.activity.entries[0]).toMatchObject({ id: UPLOAD_ID, status: "failed" });
    });
    expect(toast).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "experimentData.uploadDataModal.transfer.failed",
        variant: "destructive",
      }),
    );
  });

  it("returns a mutation result with a mutate function", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    expect(typeof result.current.mutate).toBe("function");
  });
});

describe("useExperimentDataUpload (stripExcluded)", () => {
  it("filters .DS_Store and keeps the rest", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList([makeFile(".DS_Store"), makeFile("data.csv")]);
    const kept = result.current.stripExcluded(files);
    expect(kept).toHaveLength(1);
    expect(kept[0].name).toBe("data.csv");
  });
});

describe("useExperimentDataUpload (validate tabular)", () => {
  it("returns the expected kind when all files match", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList([makeFile("a.csv"), makeFile("b.csv")]);
    expect(result.current.validate(files, "csv")).toEqual({ sourceKind: "csv" });
  });

  it("returns wrongFormat when a file is a different tabular kind than selected", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList([makeFile("a.csv"), makeFile("b.tsv")]);
    expect(result.current.validate(files, "csv")).toEqual({
      code: "wrongFormat",
      fileName: "b.tsv",
      expected: "csv",
    });
  });

  it("returns unsupportedFormat for unknown extensions", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList([makeFile("readme.md")]);
    expect(result.current.validate(files, "csv")).toEqual({
      code: "unsupportedFormat",
      fileName: "readme.md",
    });
  });

  it("treats an ambyte-shaped file as unsupported when expecting tabular", () => {
    // .txt infers ambyte; in the tabular flow it's not an acceptable file at all,
    // so it surfaces as unsupportedFormat rather than a wrong tabular kind.
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList([makeFile("trace.txt")]);
    expect(result.current.validate(files, "csv")).toEqual({
      code: "unsupportedFormat",
      fileName: "trace.txt",
    });
  });

  it("returns noFiles when all files are excluded", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList([makeFile(".DS_Store")]);
    expect(result.current.validate(files, "csv")).toEqual({ code: "noFiles" });
  });

  it("returns oversizedFiles when a file exceeds the per-kind cap", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList([makeFile("big.csv", { size: 100 * 1024 * 1024 })]);
    expect(result.current.validate(files, "csv")).toEqual({ code: "oversizedFiles", count: 1 });
  });

  it("returns tooManyFiles when the count exceeds the per-kind cap", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList(Array.from({ length: 101 }, (_, i) => makeFile(`row-${i}.csv`)));
    expect(result.current.validate(files, "csv")).toEqual({ code: "tooManyFiles", max: 100 });
  });
});

describe("useExperimentDataUpload (validate ambyte)", () => {
  it("accepts a root-level Ambyte_<n> folder", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList([makeFile("trace.txt", { relativePath: "Ambyte_1/trace.txt" })]);
    expect(result.current.validate(files, "ambyte")).toEqual({ sourceKind: "ambyte" });
  });

  it("accepts an outer folder containing Ambyte_<n> subdirs", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList([
      makeFile("trace.txt", { relativePath: "Experiment/Ambyte_5/trace.txt" }),
    ]);
    expect(result.current.validate(files, "ambyte")).toEqual({ sourceKind: "ambyte" });
  });

  it("returns ambyteInvalidStructure when no Ambyte_<n> folder is found", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList([
      makeFile("trace.txt", { relativePath: "Experiment/random/trace.txt" }),
    ]);
    expect(result.current.validate(files, "ambyte")).toEqual({ code: "ambyteInvalidStructure" });
  });

  it("returns ambyteInvalidStructure when files have no webkitRelativePath (flat picker)", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList([makeFile("trace.txt")]);
    expect(result.current.validate(files, "ambyte")).toEqual({ code: "ambyteInvalidStructure" });
  });

  it("returns ambyteOversizedFiles when a file exceeds the per-kind cap", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList([
      makeFile("trace.txt", { relativePath: "Ambyte_1/trace.txt", size: 100 * 1024 * 1024 }),
    ]);
    expect(result.current.validate(files, "ambyte")).toMatchObject({
      code: "ambyteOversizedFiles",
      count: 1,
    });
  });

  it("returns tooManyFiles when the folder holds more files than the per-kind cap", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList(
      Array.from({ length: 1001 }, (_, i) =>
        makeFile(`trace-${i}.txt`, { relativePath: `Ambyte_1/trace-${i}.txt` }),
      ),
    );
    expect(result.current.validate(files, "ambyte")).toEqual({ code: "tooManyFiles", max: 1000 });
  });

  it("returns noFiles when all files are excluded", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList([makeFile(".DS_Store", { relativePath: "Ambyte_1/.DS_Store" })]);
    expect(result.current.validate(files, "ambyte")).toEqual({ code: "noFiles" });
  });
});
