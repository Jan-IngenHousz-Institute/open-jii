import type { Readable } from "stream";

export interface UploadFileResponse {
  filePath: string;
}

export interface DownloadFileResponse {
  stream: Readable;
  contentLength?: number;
}
