import { renderHook, waitFor, act } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useExperimentDataUpload } from "./useExperimentDataUpload";

// ── helpers ─────────────────────────────────────────────────────

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

// ── hook + mutation ────────────────────────────────────────────

describe("useExperimentDataUpload (mutation)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // uploadData is a native streaming endpoint posted via a raw fetch (off the
  // oRPC contract), so the request is asserted against the mocked global fetch.
  it("posts a multipart upload to the generic uploads endpoint", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ uploadId: "u-1", files: [{ fileName: "data.csv", filePath: "/x/y" }] }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      );

    const { result } = renderHook(() => useExperimentDataUpload());

    act(() => {
      result.current.mutate({ params: { id: "exp-1" }, body: buildFormData() });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/experiments/exp-1/data/uploads"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toBeInstanceOf(FormData);
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
      result.current.mutate({ params: { id: "exp-1" }, body: buildFormData() });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("returns a mutation result with a mutate function", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    expect(typeof result.current.mutate).toBe("function");
  });
});

// ── stripExcluded ──────────────────────────────────────────────

describe("useExperimentDataUpload (stripExcluded)", () => {
  it("filters .DS_Store and keeps the rest", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList([makeFile(".DS_Store"), makeFile("data.csv")]);
    const kept = result.current.stripExcluded(files);
    expect(kept).toHaveLength(1);
    expect(kept[0].name).toBe("data.csv");
  });
});

// ── validate (tabular) ─────────────────────────────────────────

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

// ── validate (ambyte) ──────────────────────────────────────────

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

  it("returns noFiles when all files are excluded", () => {
    const { result } = renderHook(() => useExperimentDataUpload());
    const files = makeFileList([makeFile(".DS_Store", { relativePath: "Ambyte_1/.DS_Store" })]);
    expect(result.current.validate(files, "ambyte")).toEqual({ code: "noFiles" });
  });
});
