import { Injectable, Logger } from "@nestjs/common";
import busboy from "busboy";
import type { IncomingHttpHeaders } from "http";

import { AsyncQueue } from "../../../common/utils/async-queue";
import { AppError, Result, failure, success } from "../../../common/utils/fp-utils";

export interface MultipartFile {
  filename: string;
  encoding: string;
  mimeType: string;
  stream: NodeJS.ReadableStream;
}

export interface ParseMultipartInput {
  requestStream: NodeJS.ReadableStream;
  requestHeaders: IncomingHttpHeaders;
  limits: { maxFileSize: number; maxFileCount: number };
  // Fields arrive before files; accumulate and inspect inside onFile.
  onField: (name: string, value: string) => void;
  // Result lets the parser short-circuit on first fatal error.
  onFile: (file: MultipartFile) => Promise<Result<void>>;
}

/**
 * Drives a multipart/form-data request through busboy, runs file handlers
 * sequentially, and stops accepting further files once any handler fails.
 */
@Injectable()
export class MultipartUploadService {
  private readonly logger = new Logger(MultipartUploadService.name);

  async parse(input: ParseMultipartInput): Promise<Result<void>> {
    const { requestStream, requestHeaders, limits, onField, onFile } = input;

    const contentType = requestHeaders["content-type"];
    if (!contentType?.includes("multipart/form-data")) {
      return failure(AppError.badRequest("Request must be multipart/form-data"));
    }

    const processingQueue = new AsyncQueue(1, this.logger);
    const state: { firstFailure: Result<void> | null } = { firstFailure: null };

    try {
      await new Promise<void>((resolve, reject) => {
        const bb = busboy({
          headers: requestHeaders,
          limits: { fileSize: limits.maxFileSize, files: limits.maxFileCount },
          preservePath: true,
        });

        bb.on("field", onField);

        bb.on("file", (fieldname, fileStream, info) => {
          if (fieldname !== "files") {
            fileStream.resume();
            return;
          }
          if (state.firstFailure) {
            fileStream.resume();
            return;
          }
          // Per-file cap. Busboy emits "limit" silently; surface as failure.
          fileStream.on("limit", () => {
            state.firstFailure ??= failure(
              AppError.badRequest(`File '${info.filename}' exceeds the maximum allowed size`),
            );
          });
          processingQueue.add(async () => {
            // Siblings queue before the first task drains, so recheck here.
            if (state.firstFailure) {
              fileStream.resume();
              return;
            }
            const result = await onFile({
              filename: info.filename,
              encoding: info.encoding,
              mimeType: info.mimeType,
              stream: fileStream,
            });
            // `??=` preserves a filesLimit failure that fired during await.
            if (result.isFailure()) {
              state.firstFailure ??= result;
            }
          }, info.filename);
        });

        // Busboy drops parts past `limits.files` silently; surface as failure.
        bb.on("filesLimit", () => {
          state.firstFailure ??= failure(AppError.badRequest("Too many files in upload"));
        });

        bb.on("error", (err) => reject(err instanceof Error ? err : new Error(String(err))));
        bb.on("close", () => {
          processingQueue
            .waitForCompletion()
            .then(() => resolve())
            .catch((err) => reject(err instanceof Error ? err : new Error(String(err))));
        });

        requestStream.pipe(bb);
      });
    } catch (err: unknown) {
      this.logger.error({
        msg: "Multipart parsing failed",
        operation: "multipartUpload.parse",
        error: String(err),
      });
      return failure(AppError.internal("Error processing upload", "UPLOAD_PARSE_FAILED"));
    }

    if (state.firstFailure) {
      return state.firstFailure;
    }
    return success(undefined);
  }
}
