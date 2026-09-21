import { Injectable } from "@nestjs/common";
import Busboy from "busboy";
import type { Request } from "express";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import { AppError } from "../../common/utils/fp-utils";
import { AssistantKnowledgeStore } from "./assistant-knowledge.store";

const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".tif",
  ".tiff",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
]);

export interface ReceivedAssistantFile {
  fields: Record<string, string>;
  fileName: string;
  mediaType: string;
  byteSize: number;
  localFilePath: string;
}

@Injectable()
export class AssistantKnowledgeUploadService {
  constructor(private readonly store: AssistantKnowledgeStore) {}

  async receive(
    request: Request,
    destination: { scope: "documents" | "corpus"; ownerId: string; recordId: string },
  ): Promise<ReceivedAssistantFile> {
    const contentType = request.headers["content-type"];
    if (!contentType?.startsWith("multipart/form-data")) {
      throw AppError.badRequest("Expected a multipart/form-data upload.");
    }
    const temporaryDirectory = path.join(this.store.getDataDirectory(), "tmp");
    await mkdir(temporaryDirectory, { recursive: true, mode: 0o700 });
    const temporaryPath = path.join(temporaryDirectory, `${crypto.randomUUID()}.upload`);
    const fields: Record<string, string> = {};
    const uploadState: {
      fileName: string;
      mediaType: string;
      byteSize: number;
      fileReceived: boolean;
      fileTooLarge: boolean;
      error: AppError | null;
      writes: Promise<void>[];
    } = {
      fileName: "",
      mediaType: "",
      byteSize: 0,
      fileReceived: false,
      fileTooLarge: false,
      error: null,
      writes: [],
    };

    const parser = Busboy({
      headers: request.headers,
      limits: { files: 1, fields: 10, fileSize: MAX_DOCUMENT_BYTES },
    });
    parser.on("field", (name, value) => {
      fields[name] = value;
    });
    parser.on("filesLimit", () => {
      uploadState.error = AppError.badRequest("Upload exactly one file in the 'file' field.");
    });
    parser.on("file", (fieldName, stream, info) => {
      if (fieldName !== "file" || uploadState.fileReceived) {
        stream.resume();
        uploadState.error = AppError.badRequest("Upload exactly one file in the 'file' field.");
        return;
      }
      uploadState.fileReceived = true;
      const safeName = path.basename(info.filename).replace(/[^A-Za-z0-9._ -]/gu, "_");
      const extension = path.extname(safeName).toLocaleLowerCase();
      if (!safeName || !ALLOWED_EXTENSIONS.has(extension)) {
        stream.resume();
        uploadState.error = AppError.badRequest(
          "Supported document types are PDF, JPG, PNG, TIFF, DOC, DOCX, PPT and PPTX.",
          "DOCUMENT_TYPE_UNSUPPORTED",
        );
        return;
      }
      uploadState.fileName = safeName;
      uploadState.mediaType = info.mimeType || "application/octet-stream";
      stream.on("data", (chunk: Buffer) => {
        uploadState.byteSize += chunk.length;
      });
      stream.on("limit", () => {
        uploadState.fileTooLarge = true;
      });
      uploadState.writes.push(
        pipeline(stream, createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 })),
      );
    });

    try {
      await new Promise<void>((resolve, reject) => {
        parser.once("close", resolve);
        parser.once("error", reject);
        request.once("aborted", () => reject(new Error("Upload was aborted")));
        request.pipe(parser);
      });
      await Promise.all(uploadState.writes);
      if (uploadState.error) {
        throw uploadState.error;
      }
      if (uploadState.fileTooLarge) {
        throw AppError.badRequest(
          `Document exceeds the ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB limit.`,
          "DOCUMENT_TOO_LARGE",
        );
      }
      if (
        !uploadState.fileReceived ||
        !uploadState.fileName ||
        !uploadState.mediaType ||
        uploadState.byteSize === 0
      ) {
        throw AppError.badRequest("The multipart request did not contain a readable file.");
      }
      const destinationDirectory = path.join(
        this.store.getDataDirectory(),
        "uploads",
        destination.scope,
        destination.ownerId,
        destination.recordId,
      );
      await mkdir(destinationDirectory, { recursive: true, mode: 0o700 });
      const localFilePath = path.join(destinationDirectory, uploadState.fileName);
      await rename(temporaryPath, localFilePath);
      return {
        fields,
        fileName: uploadState.fileName,
        mediaType: uploadState.mediaType,
        byteSize: uploadState.byteSize,
        localFilePath,
      };
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error instanceof AppError
        ? error
        : AppError.badRequest(
            error instanceof Error ? error.message : "Document upload failed",
            "DOCUMENT_UPLOAD_FAILED",
          );
    }
  }
}
