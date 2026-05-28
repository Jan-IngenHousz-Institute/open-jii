import type { Request } from "express";
import { PassThrough } from "stream";
import { describe, expect, it, vi } from "vitest";

import { AppError, failure, success } from "../../../common/utils/fp-utils";
import { MultipartUploadService } from "./multipart-upload.service";

const BOUNDARY = "----TestBoundary";

// Build a real multipart/form-data Request-like stream. Order matters: fields
// before files, mirroring how well-formed browser uploads arrive.
function multipartRequest(
  parts: (
    | { kind: "field"; name: string; value: string }
    | { kind: "file"; fieldname: string; filename: string; content: string; mime: string }
  )[],
  contentTypeOverride?: string,
): Pick<Request, "headers"> & NodeJS.ReadableStream {
  const body = parts
    .map((p) => {
      if (p.kind === "field") {
        return `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${p.name}"\r\n\r\n${p.value}\r\n`;
      }
      return `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${p.fieldname}"; filename="${p.filename}"\r\nContent-Type: ${p.mime}\r\n\r\n${p.content}\r\n`;
    })
    .concat(`--${BOUNDARY}--\r\n`)
    .join("");

  const stream = new PassThrough();
  stream.end(Buffer.from(body));
  return Object.assign(stream, {
    headers: {
      "content-type": contentTypeOverride ?? `multipart/form-data; boundary=${BOUNDARY}`,
    },
  }) as Pick<Request, "headers"> & NodeJS.ReadableStream;
}

// Drain a file stream and resolve once it ends, so busboy can finish.
async function drain(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

describe("MultipartUploadService", () => {
  const limits = { maxFileSize: 10 * 1024 * 1024, maxFileCount: 10 };
  const service = new MultipartUploadService();

  it("rejects non-multipart requests", async () => {
    const req = multipartRequest([], "application/json");

    const result = await service.parse({
      requestStream: req,
      requestHeaders: req.headers,
      limits,
      onField: vi.fn(),
      onFile: vi.fn(),
    });

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      expect(result.error.code).toBe("BAD_REQUEST");
    }
  });

  it("forwards fields to onField in order and invokes onFile per file", async () => {
    const req = multipartRequest([
      { kind: "field", name: "sourceKind", value: "csv" },
      { kind: "field", name: "targetKind", value: "new" },
      { kind: "field", name: "targetName", value: "leaf_traits" },
      {
        kind: "file",
        fieldname: "files",
        filename: "a.csv",
        content: "x,y\n1,2",
        mime: "text/csv",
      },
      {
        kind: "file",
        fieldname: "files",
        filename: "b.csv",
        content: "x,y\n3,4",
        mime: "text/csv",
      },
    ]);

    const fields: [string, string][] = [];
    const filenames: string[] = [];

    const result = await service.parse({
      requestStream: req,
      requestHeaders: req.headers,
      limits,
      onField: (name, value) => fields.push([name, value]),
      onFile: async (file) => {
        filenames.push(file.filename);
        await drain(file.stream);
        return success(undefined);
      },
    });

    expect(result.isSuccess()).toBe(true);
    expect(fields).toEqual([
      ["sourceKind", "csv"],
      ["targetKind", "new"],
      ["targetName", "leaf_traits"],
    ]);
    expect(filenames).toEqual(["a.csv", "b.csv"]);
  });

  it("skips files whose fieldname is not 'files'", async () => {
    const req = multipartRequest([
      { kind: "file", fieldname: "attachment", filename: "x.csv", content: "x", mime: "text/csv" },
      { kind: "file", fieldname: "files", filename: "y.csv", content: "y", mime: "text/csv" },
    ]);

    const onFile = vi.fn(async (file: { filename: string; stream: NodeJS.ReadableStream }) => {
      await drain(file.stream);
      return success(undefined);
    });

    const result = await service.parse({
      requestStream: req,
      requestHeaders: req.headers,
      limits,
      onField: vi.fn(),
      onFile,
    });

    expect(result.isSuccess()).toBe(true);
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile.mock.calls[0][0].filename).toBe("y.csv");
  });

  it("returns the first failure from onFile and propagates its error", async () => {
    const req = multipartRequest([
      { kind: "file", fieldname: "files", filename: "bad.csv", content: "x", mime: "text/csv" },
      { kind: "file", fieldname: "files", filename: "good.csv", content: "y", mime: "text/csv" },
    ]);

    const onFile = vi.fn(async (file: { filename: string; stream: NodeJS.ReadableStream }) => {
      await drain(file.stream);
      if (file.filename === "bad.csv") {
        return failure(AppError.badRequest("synthetic-file-error"));
      }
      return success(undefined);
    });

    const result = await service.parse({
      requestStream: req,
      requestHeaders: req.headers,
      limits,
      onField: vi.fn(),
      onFile,
    });

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      expect(result.error.message).toBe("synthetic-file-error");
    }
    // Short-circuits after the first failure — good.csv is never invoked.
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile.mock.calls[0][0].filename).toBe("bad.csv");
  });

  it("returns success when no files are received", async () => {
    const req = multipartRequest([{ kind: "field", name: "sourceKind", value: "csv" }]);

    const onFile = vi.fn();

    const result = await service.parse({
      requestStream: req,
      requestHeaders: req.headers,
      limits,
      onField: vi.fn(),
      onFile,
    });

    expect(result.isSuccess()).toBe(true);
    expect(onFile).not.toHaveBeenCalled();
  });

  it("wraps busboy parsing errors as UPLOAD_PARSE_FAILED", async () => {
    // Missing boundary parameter forces busboy to throw during construction.
    const req = multipartRequest([], "multipart/form-data");

    const result = await service.parse({
      requestStream: req,
      requestHeaders: req.headers,
      limits,
      onField: vi.fn(),
      onFile: vi.fn(),
    });

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      expect(result.error.code).toBe("UPLOAD_PARSE_FAILED");
    }
  });

  it("surfaces a 'Too many files' failure when filesLimit fires", async () => {
    // limits.files = 1; uploading 2 files trips busboy's filesLimit.
    const req = multipartRequest([
      { kind: "file", fieldname: "files", filename: "a.csv", content: "1", mime: "text/csv" },
      { kind: "file", fieldname: "files", filename: "b.csv", content: "2", mime: "text/csv" },
    ]);

    const result = await service.parse({
      requestStream: req,
      requestHeaders: req.headers,
      limits: { maxFileSize: 10 * 1024, maxFileCount: 1 },
      onField: vi.fn(),
      onFile: async (file) => {
        await drain(file.stream);
        return success(undefined);
      },
    });

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      expect(result.error.message).toContain("Too many files");
    }
  });

  it("surfaces a per-file size-cap failure when a file stream emits 'limit'", async () => {
    // maxFileSize is below the actual file content, so busboy emits "limit"
    // on the file stream once it exceeds the cap.
    const req = multipartRequest([
      {
        kind: "file",
        fieldname: "files",
        filename: "oversized.csv",
        content: "x".repeat(100),
        mime: "text/csv",
      },
    ]);

    const result = await service.parse({
      requestStream: req,
      requestHeaders: req.headers,
      limits: { maxFileSize: 10, maxFileCount: 10 },
      onField: vi.fn(),
      onFile: async (file) => {
        await drain(file.stream);
        return success(undefined);
      },
    });

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      expect(result.error.message).toContain("exceeds the maximum allowed size");
    }
  });
});
