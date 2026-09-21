import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import { pathFromRoot, repositoryRoot, requireLinearApiKey } from "../lib/config.js";
import { createFileAudit, createLinearClient } from "../lib/linear.js";
import type { LinearClient } from "../lib/linear.js";

export interface UploadTarget {
  uploadUrl: string;
  assetUrl: string;
  headers: { key: string; value: string }[];
}

export interface PutResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

export interface UploadDependencies {
  client: LinearClient;
  readBytes: (path: string) => Promise<Uint8Array<ArrayBuffer>>;
  put: (
    url: string,
    headers: Record<string, string>,
    body: Uint8Array<ArrayBuffer>,
  ) => Promise<PutResponse>;
  write: (text: string) => void;
}

interface FileUploadResult {
  fileUpload: { success: boolean; uploadFile: UploadTarget };
}

const fileUploadMutation = `mutation($contentType: String!, $filename: String!, $size: Int!) {
  fileUpload(contentType: $contentType, filename: $filename, size: $size) {
    success
    uploadFile { uploadUrl assetUrl headers { key value } }
  }
}`;

// The types a project resource is made of. Anything else needs --type.
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".zip": "application/zip",
  ".json": "application/json",
  ".csv": "text/csv",
};

export function contentTypeFor(file: string): string | null {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? null;
}

export function parseArgs(args: string[]): { file: string; contentType: string | null } {
  const typeIndex = args.indexOf("--type");
  const explicit = typeIndex >= 0 ? args[typeIndex + 1] : undefined;
  if (typeIndex >= 0 && (!explicit || explicit.startsWith("--"))) {
    throw new Error("--type requires a media type such as text/html");
  }
  const file = args.find((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--type");
  if (!file) throw new Error("Usage: linear-upload <file> [--type <media type>]");
  return { file, contentType: explicit ?? contentTypeFor(file) };
}

// Two steps, as Linear's API defines it: ask for a signed upload target, then PUT the bytes to
// it with the headers Linear hands back. The asset URL is what a document links to.
export async function uploadFile(
  file: string,
  contentType: string,
  deps: UploadDependencies,
): Promise<string> {
  const bytes = await deps.readBytes(file);
  const result = await deps.client.query<FileUploadResult>(fileUploadMutation, {
    contentType,
    filename: basename(file),
    size: bytes.byteLength,
  });
  if (!result.fileUpload.success) throw new Error(`Linear refused the upload of ${file}`);

  const target = result.fileUpload.uploadFile;
  const headers: Record<string, string> = {
    "content-type": contentType,
    "cache-control": "public, max-age=31536000",
  };
  for (const header of target.headers) headers[header.key] = header.value;

  const response = await deps.put(target.uploadUrl, headers, bytes);
  if (!response.ok) {
    throw new Error(`Uploading ${file} failed with ${response.status}: ${await response.text()}`);
  }
  deps.write(`${target.assetUrl}\n`);
  return target.assetUrl;
}

async function run(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  if (parsed.contentType === null) {
    throw new Error(`No media type known for ${parsed.file}; pass --type <media type>`);
  }
  const root = repositoryRoot();
  const apiKey = await requireLinearApiKey(root, process.env);
  const client = createLinearClient({ apiKey, audit: createFileAudit(root) });
  await uploadFile(pathFromRoot(parsed.file, root), parsed.contentType, {
    client,
    // A fresh Uint8Array owns a plain ArrayBuffer, which is what fetch accepts as a body.
    readBytes: async (path) => new Uint8Array(await readFile(path)),
    put: (url, headers, body) => fetch(url, { method: "PUT", headers, body }),
    write: (text) => {
      process.stdout.write(text);
    },
  });
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
