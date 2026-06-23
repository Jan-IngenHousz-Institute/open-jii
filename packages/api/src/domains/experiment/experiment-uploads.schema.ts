import { z } from "zod";

export const zExperimentUploadSourceKind = z
  .enum(["ambyte", "csv", "tsv", "parquet", "xlsx", "json", "ndjson"])
  .describe("Source format for the upload");

// Per-kind constants consumed by the backend (volume path, busboy limits, etc.)
// and the frontend (upload wizard limits, file-picker `accept` attribute).
// Kept in one place so adding a new kind is a single-entry change. All
// user-table-bound kinds share volumeSourceType="uploads" so they land in the
// same raw_uploaded_data table; the Python task dispatches by source_kind to
// pick the right parser.
export const UPLOAD_KIND_CONSTANTS = {
  ambyte: {
    volumeSourceType: "uploads",
    maxFileSize: 10 * 1024 * 1024,
    maxFileCount: 1000,
    extensions: [".txt"],
  },
  csv: {
    volumeSourceType: "uploads",
    maxFileSize: 50 * 1024 * 1024,
    maxFileCount: 100,
    extensions: [".csv"],
  },
  tsv: {
    volumeSourceType: "uploads",
    maxFileSize: 50 * 1024 * 1024,
    maxFileCount: 100,
    extensions: [".tsv"],
  },
  parquet: {
    volumeSourceType: "uploads",
    maxFileSize: 200 * 1024 * 1024,
    maxFileCount: 100,
    extensions: [".parquet"],
  },
  xlsx: {
    volumeSourceType: "uploads",
    maxFileSize: 50 * 1024 * 1024,
    maxFileCount: 100,
    extensions: [".xlsx", ".xls"],
  },
  json: {
    volumeSourceType: "uploads",
    maxFileSize: 100 * 1024 * 1024,
    maxFileCount: 100,
    extensions: [".json"],
  },
  ndjson: {
    volumeSourceType: "uploads",
    maxFileSize: 100 * 1024 * 1024,
    maxFileCount: 100,
    extensions: [".ndjson", ".jsonl"],
  },
} as const satisfies Record<
  z.infer<typeof zExperimentUploadSourceKind>,
  {
    volumeSourceType: string;
    maxFileSize: number;
    maxFileCount: number;
    extensions: readonly string[];
  }
>;

/**
 * Infer the upload source kind from a filename's extension. Returns null when
 * the extension isn't supported by any configured kind. Used by the upload
 * modal to pick the source kind automatically and reject unknown formats.
 */
export function inferUploadSourceKind(filename: string): z.infer<typeof zExperimentUploadSourceKind> | null {
  const lower = filename.toLowerCase();
  for (const [kind, config] of Object.entries(UPLOAD_KIND_CONSTANTS)) {
    for (const ext of config.extensions) {
      if (lower.endsWith(ext)) {
        return kind as z.infer<typeof zExperimentUploadSourceKind>;
      }
    }
  }
  return null;
}

// SQL identifier shape we enforce for user-defined upload table names:
// first char letter, then [A-Za-z0-9_], max 63 chars.
const isAsciiLetter = (c: string): boolean => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
const isAsciiDigit = (c: string): boolean => c >= "0" && c <= "9";

export const zExperimentUploadTableName = z
  .string()
  .min(1)
  .max(63)
  .refine(
    (name) => {
      if (!isAsciiLetter(name[0])) {
        return false;
      }
      for (let i = 1; i < name.length; i++) {
        const c = name[i];
        if (!isAsciiLetter(c) && !isAsciiDigit(c) && c !== "_") {
          return false;
        }
      }
      return true;
    },
    {
      message:
        "Table name must start with a letter and contain only letters, digits, or underscores (max 63 chars)",
    },
  )
  .refine((name) => !name.startsWith("_"), {
    message: "Table names cannot start with an underscore",
  });

export const zExperimentUploadTargetTable = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("new"), name: zExperimentUploadTableName }),
  z.object({ kind: z.literal("existing"), uploadTableId: z.string().uuid() }),
]);
export type ExperimentUploadTargetTable = z.infer<typeof zExperimentUploadTargetTable>;

// Form fields shared across the multipart upload boundary. The FE binds this
// schema to react-hook-form via zodResolver; the BE validates the same shape
// on the busboy-parsed field map. Files are out of scope (multipart-streamed).
export const zExperimentUploadFormFields = z.discriminatedUnion("targetKind", [
  z.object({
    targetKind: z.literal("new"),
    sourceKind: zExperimentUploadSourceKind,
    targetName: zExperimentUploadTableName,
  }),
  z.object({
    targetKind: z.literal("existing"),
    sourceKind: zExperimentUploadSourceKind,
    uploadTableId: z.string().uuid(),
  }),
]);
export type ExperimentUploadFormFields = z.infer<typeof zExperimentUploadFormFields>;

// Bare-basename filename schema for kinds where the file is "just the file" —
// strip any leading path the client may have sent, enforce extension + length.
function bareBasenameSchema(label: string, extensions: readonly string[]) {
  return z
    .string()
    .min(1)
    .max(256)
    .transform((name, ctx) => {
      const base = name.split(/[\\/]/).pop() ?? "";
      if (!base || base.length > 256) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid file name" });
        return z.NEVER;
      }
      const lower = base.toLowerCase();
      if (!extensions.some((ext) => lower.endsWith(ext))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${base} is not a ${label} file`,
        });
        return z.NEVER;
      }
      return base;
    });
}

export const zExperimentCsvFilename = bareBasenameSchema("CSV", UPLOAD_KIND_CONSTANTS.csv.extensions);
export const zExperimentTsvFilename = bareBasenameSchema("TSV", UPLOAD_KIND_CONSTANTS.tsv.extensions);
export const zExperimentParquetFilename = bareBasenameSchema(
  "parquet",
  UPLOAD_KIND_CONSTANTS.parquet.extensions,
);
export const zExperimentXlsxFilename = bareBasenameSchema("Excel", UPLOAD_KIND_CONSTANTS.xlsx.extensions);
export const zExperimentJsonFilename = bareBasenameSchema("JSON", UPLOAD_KIND_CONSTANTS.json.extensions);
export const zExperimentNdjsonFilename = bareBasenameSchema(
  "NDJSON",
  UPLOAD_KIND_CONSTANTS.ndjson.extensions,
);

// Ambyte path/filename rules.
const AMBIT_SUBFOLDERS = new Set(["1", "2", "3", "4"]);
const isAllAsciiDigits = (s: string): boolean => {
  if (s.length === 0) {
    return false;
  }
  for (const c of s) {
    if (!isAsciiDigit(c)) {
      return false;
    }
  }
  return true;
};
const isAmbyteFolderName = (segment: string): boolean => {
  if (segment.length < 8 || segment.length > 10) {
    return false;
  }
  if (segment.slice(0, 7).toLowerCase() !== "ambyte_") {
    return false;
  }
  return isAllAsciiDigits(segment.slice(7));
};
const isAmbyteTimestampFilename = (name: string): boolean => {
  if (name.length !== 20) {
    return false;
  }
  return (
    isAllAsciiDigits(name.slice(0, 8)) &&
    name[8] === "-" &&
    isAllAsciiDigits(name.slice(9, 15)) &&
    name[15] === "_" &&
    name.slice(16).toLowerCase() === ".txt"
  );
};

export const zExperimentAmbyteFilename = z
  .string()
  .min(1)
  .max(256)
  .transform((name, ctx) => {
    if (!name.toLowerCase().endsWith(".txt")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ambyte uploads must be .txt files",
      });
      return z.NEVER;
    }
    if (!name.includes("/")) {
      if (isAmbyteTimestampFilename(name)) {
        return `unknown_ambyte/unknown_ambit/${name}`;
      }
      return `unknown_ambyte/${name}`;
    }
    const parts = name.split("/").filter((p) => p.length > 0);
    for (let i = parts.length - 2; i >= 0; i--) {
      if (!isAmbyteFolderName(parts[i])) {
        continue;
      }
      const tail = parts.slice(i);
      if (tail.length === 2 && tail[1].toLowerCase().endsWith(".txt")) {
        return tail.join("/");
      }
      if (
        tail.length === 3 &&
        AMBIT_SUBFOLDERS.has(tail[1]) &&
        tail[2].toLowerCase().endsWith(".txt")
      ) {
        return tail.join("/");
      }
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Path must end with "Ambyte_N/*.txt" or "Ambyte_N/[1-4]/*.txt"',
    });
    return z.NEVER;
  });

export const UPLOAD_FILENAME_SCHEMAS = {
  ambyte: zExperimentAmbyteFilename,
  csv: zExperimentCsvFilename,
  tsv: zExperimentTsvFilename,
  parquet: zExperimentParquetFilename,
  xlsx: zExperimentXlsxFilename,
  json: zExperimentJsonFilename,
  ndjson: zExperimentNdjsonFilename,
} as const satisfies Record<z.infer<typeof zExperimentUploadSourceKind>, z.ZodTypeAny>;

// Multipart form data carries: targetKind, targetName, sourceKind, files[]
export const zExperimentUploadDataBody = z.any();

export const zExperimentUploadDataResponse = z.object({
  uploadId: z.string().describe("UUID of this upload"),
  uploadTableId: z
    .string()
    .optional()
    .describe(
      "Stable UUID of the logical upload table (assigned on first upload). Present for target-backed uploads.",
    ),
  uploadTableName: z
    .string()
    .optional()
    .describe("User-chosen display name for the upload table. Present for target-backed uploads."),
  runId: z.number().int().optional().describe("Databricks job run id for status polling"),
  files: z.array(
    z.object({
      fileName: z.string(),
      filePath: z.string(),
    }),
  ),
});

export const zExperimentUploadHistoryStatus = z.enum(["pending", "running", "completed", "failed"]);

export const zExperimentUploadMetadata = z.object({
  uploadId: z.string(),
  experimentId: z.string(),
  uploadTableId: z.string().nullable(),
  uploadTableName: z.string().nullable(),
  sourceKind: zExperimentUploadSourceKind,
  status: zExperimentUploadHistoryStatus,
  fileCount: z.number().int().nullable(),
  rowCount: z.number().int().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
});

export const zExperimentListUploadsQuery = z.object({
  uploadTableId: z.string().uuid().optional(),
  uploadTableName: zExperimentUploadTableName.optional(),
});

export const zExperimentListUploadsResponse = z.object({
  uploads: z.array(zExperimentUploadMetadata),
});
export type ExperimentUploadSourceKind = z.infer<typeof zExperimentUploadSourceKind>;
export type ExperimentUploadDataBody = z.infer<typeof zExperimentUploadDataBody>;
export type ExperimentUploadDataResponse = z.infer<typeof zExperimentUploadDataResponse>;
export type ExperimentUploadHistoryStatus = z.infer<typeof zExperimentUploadHistoryStatus>;
export type ExperimentUploadMetadata = z.infer<typeof zExperimentUploadMetadata>;
export type ExperimentListUploadsQuery = z.infer<typeof zExperimentListUploadsQuery>;
export type ExperimentListUploadsResponse = z.infer<typeof zExperimentListUploadsResponse>;
