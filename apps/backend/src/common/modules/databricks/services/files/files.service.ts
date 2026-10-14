import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import http from "http";
import https from "https";
import { Readable } from "stream";
import { setTimeout as sleep } from "timers/promises";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { ErrorCodes } from "../../../../utils/error-codes";
import { Result, tryCatch, apiErrorMapper } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import type { DownloadFileResponse, UploadFileResponse } from "./files.types";

@Injectable()
export class DatabricksFilesService {
  private readonly logger = new Logger(DatabricksFilesService.name);

  public static readonly FILES_ENDPOINT = "/api/2.0/fs/files";

  // Hard cap enforced by the Databricks Files API: per-file uploads max out at 5 GiB.
  // https://docs.databricks.com/api/workspace/files/upload
  public static readonly MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

  public static readonly MAX_RESETS_WITHOUT_PROGRESS = 3;

  public static readonly RESUME_DELAY_MS = 250;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: DatabricksConfigService,
    private readonly authService: DatabricksAuthService,
  ) {}

  /**
   * Upload a file to a specified path in Databricks workspace.
   * The caller is responsible for constructing the full path.
   *
   * Accepts either a Buffer (uses Content-Length) or a Readable stream
   * (uses chunked transfer encoding). Streaming avoids buffering the whole
   * file in memory and is preferred for any upload originating from an HTTP
   * request body.
   *
   * @param filePath - The full destination path for the file in Databricks.
   * @param body - File contents as a Buffer or Readable stream.
   * @returns Result containing file ID and path.
   */
  async upload(
    filePath: string,
    body: Buffer | NodeJS.ReadableStream,
  ): Promise<Result<UploadFileResponse>> {
    return await tryCatch(
      async () => {
        if (Buffer.isBuffer(body) && body.length > DatabricksFilesService.MAX_UPLOAD_BYTES) {
          throw new Error(
            `File exceeds Databricks per-file limit of ${DatabricksFilesService.MAX_UPLOAD_BYTES} bytes`,
          );
        }

        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const host = this.configService.getHost();
        const apiUrl = `${host}${DatabricksFilesService.FILES_ENDPOINT}`;

        this.logger.debug({
          msg: "Uploading file to Databricks",
          operation: "uploadFile",
          filePath,
          mode: Buffer.isBuffer(body) ? "buffer" : "stream",
        });

        const fullPath = `${apiUrl}${filePath}`;

        await this.httpService.axiosRef.put(fullPath, body, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
          },
          params: {
            overwrite: false,
          },
          // An explicit transport skips both redirect-following, which keeps every body chunk
          // for a replay, and axios' wall-clock timer, which would cap a slow upload at the
          // timeout. What remains is the socket's idle timeout.
          transport: fullPath.startsWith("https:") ? https : http,
          timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
          maxContentLength: Infinity,
        });

        this.logger.log({
          msg: "Successfully uploaded file to Databricks",
          operation: "uploadFile",
          filePath,
          status: "success",
        });

        return {
          filePath,
        };
      },
      (error) => {
        this.logger.error({
          msg: "Failed to upload file to Databricks",
          errorCode: ErrorCodes.DATABRICKS_FILE_FAILED,
          operation: "uploadFile",
          error,
        });
        return apiErrorMapper(
          `Failed to upload file to Databricks: ${getAxiosErrorMessage(error)}`,
        );
      },
    );
  }

  /**
   * Download a file from Databricks as a stream
   * @param filePath - The full path to the file in Databricks (e.g., /Volumes/catalog/schema/volume/path/file.csv)
   * @returns Result containing a readable stream of the file contents and its size when known
   */
  async download(filePath: string): Promise<Result<DownloadFileResponse>> {
    return await tryCatch(
      async () => {
        this.logger.debug({
          msg: "Downloading file from Databricks",
          operation: "downloadFile",
          filePath,
        });

        const response = await this.requestFile(filePath, 0);

        this.logger.log({
          msg: "Successfully initiated file download from Databricks",
          operation: "downloadFile",
          filePath,
          status: "success",
        });

        const length = Number(response.headers["content-length"] ?? Number.NaN);
        const contentLength = Number.isSafeInteger(length) ? length : undefined;

        return {
          stream: this.resumableStream(filePath, response.data, contentLength),
          contentLength,
        };
      },
      (error) => {
        this.logger.error({
          msg: "Failed to download file from Databricks",
          errorCode: ErrorCodes.DATABRICKS_FILE_FAILED,
          operation: "downloadFile",
          filePath,
          error,
        });
        return apiErrorMapper(
          `Failed to download file from Databricks: ${getAxiosErrorMessage(error)}`,
        );
      },
    );
  }

  /** Requests the file from `offset` on; a resumed request must come back as that exact range. */
  private async requestFile(filePath: string, offset: number) {
    const tokenResult = await this.authService.getAccessToken();
    if (tokenResult.isFailure()) {
      throw tokenResult.error;
    }

    const url = `${this.configService.getHost()}${DatabricksFilesService.FILES_ENDPOINT}${filePath}`;

    const response = await this.httpService.axiosRef.get<Readable>(url, {
      headers: {
        Authorization: `Bearer ${tokenResult.value}`,
        ...(offset > 0 ? { Range: `bytes=${offset}-` } : {}),
      },
      responseType: "stream",
      // The body is read at the client's pace; without redirects the timeout stops at the headers.
      maxRedirects: 0,
      timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
    });

    const contentRange = String(response.headers["content-range"] ?? "");
    const isExpectedRange = response.status === 206 && contentRange.startsWith(`bytes ${offset}-`);
    if (offset > 0 && !isExpectedRange) {
      response.data.destroy();
      throw new Error(`Databricks did not resume the download at byte ${offset}`);
    }

    return response;
  }

  /**
   * Databricks resets a download whose reader falls behind, which a slow client causes.
   * Each reset re-requests the rest of the file, so the caller sees one unbroken stream.
   * Destroying the returned stream, as a cancelled download does, closes Databricks at once.
   */
  private resumableStream(
    filePath: string,
    first: Readable,
    contentLength: number | undefined,
  ): Readable {
    let source: Readable | null = null;
    let offset = 0;
    let resetsWithoutProgress = 0;

    const output = new Readable({
      read: () => {
        source?.resume();
      },
      destroy: (error, callback) => {
        source?.destroy();
        callback(error);
      },
    });

    const resume = async (error: Error) => {
      source = null;
      if (output.destroyed) {
        return;
      }

      const hasEveryByte = contentLength !== undefined && offset >= contentLength;
      if (hasEveryByte) {
        output.push(null);
        return;
      }

      resetsWithoutProgress += 1;
      if (resetsWithoutProgress > DatabricksFilesService.MAX_RESETS_WITHOUT_PROGRESS) {
        output.destroy(error);
        return;
      }

      this.logger.warn({
        msg: "Databricks dropped the download, resuming",
        operation: "downloadFile",
        filePath,
        offset,
        error: String(error),
      });
      await sleep(DatabricksFilesService.RESUME_DELAY_MS * resetsWithoutProgress);

      try {
        attach((await this.requestFile(filePath, offset)).data);
      } catch (requestError) {
        // A resume request can fail like the read it replaces, so it counts against the same limit.
        void resume(requestError instanceof Error ? requestError : new Error(String(requestError)));
      }
    };

    const attach = (next: Readable) => {
      // The caller may have gone away while a resume request was in flight.
      if (output.destroyed) {
        next.destroy();
        return;
      }

      source = next;
      next.on("data", (chunk: Buffer) => {
        offset += chunk.length;
        resetsWithoutProgress = 0;
        if (!output.push(chunk)) {
          next.pause();
        }
      });
      next.once("end", () => output.push(null));
      next.once("error", (error) => void resume(error));
    };

    attach(first);
    return output;
  }
}
