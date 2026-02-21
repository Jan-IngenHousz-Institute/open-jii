import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../utils/fp-utils";
import type { SchemaData } from "../../../databricks/services/sql/sql.types";
import { DeltaConfigService } from "../config/config.service";
import type { DeltaFile, DeltaMetadata } from "../shares/shares.types";

/**
 * Lazy import of hyparquet's variant decoder.
 *
 * Databricks stores VARIANT columns as a group with two BYTE_ARRAY children
 * (`value` + `metadata`) but does NOT yet emit the Parquet `VARIANT` logical
 * type annotation (as of DBR 18.x / Spark 4.1.0 on serverless compute).
 * This means hyparquet's built-in auto-decode path never triggers, and we call
 * `decodeVariantColumn` manually after detecting the layout heuristically.
 *
 * When Databricks eventually enables the annotation, hyparquet will auto-decode
 * and our manual call becomes a harmless no-op (the values will already be
 * native objects, not Uint8Arrays).
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const variantImport: Promise<{
  decodeVariantColumn: (value: unknown) => unknown;
}> = import("hyparquet/src/variant.js") as any;

/**
 * Options for parquet parsing
 */
export interface ParquetReadOptions {
  /** Subset of columns to read (omit for all columns) */
  columns?: string[];
  /** Row offset to start reading from */
  rowStart?: number;
  /** Row offset to stop reading at (exclusive) */
  rowEnd?: number;
}

/**
 * Service for processing Delta Sharing data files.
 * Handles downloading and parsing Parquet files to convert to SchemaData format.
 *
 * Variant handling strategy:
 * 1. Read with `utf8: false` so BYTE_ARRAY columns stay as raw Uint8Array
 * 2. Detect VARIANT columns via schema heuristic (or logical_type annotation)
 * 3. Decode VARIANT columns using hyparquet's `decodeVariantColumn`
 * 4. Convert remaining Uint8Arrays to strings and BigInts to numbers
 */
@Injectable()
export class DeltaDataService {
  private readonly logger = new Logger(DeltaDataService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: DeltaConfigService,
  ) {}

  /**
   * Process Delta files and metadata to create SchemaData
   * Downloads and parses Parquet files using hyparquet, preserving native data types
   */
  async processFiles(
    files: DeltaFile[],
    metadata: DeltaMetadata,
    limitHint?: number,
    options?: ParquetReadOptions,
  ): Promise<Result<SchemaData>> {
    try {
      this.logger.debug(`Processing ${files.length} Delta files with metadata schema`);

      // Parse the schema string to get column information
      const schema = JSON.parse(metadata.schemaString) as {
        type: string;
        fields: {
          name: string;
          type: string;
          nullable: boolean;
          metadata: Record<string, any>;
        }[];
      };

      // Filter columns if requested
      const requestedColumns = options?.columns;
      const schemaFields = requestedColumns
        ? schema.fields.filter((f) => requestedColumns.includes(f.name))
        : schema.fields;

      const columns = schemaFields.map((field, index) => ({
        name: field.name,
        type_name: field.type,
        type_text: field.type,
        position: index,
      }));

      // Download and parse all Parquet files
      const allRows: Record<string, unknown>[] = [];
      let totalRows = 0;
      let truncated = false;

      for (const file of files) {
        this.logger.debug(`Processing file: ${file.id}`);

        const fileResult = await this.downloadAndParseParquetFile(file, options);
        if (fileResult.isFailure()) {
          this.logger.warn(`Failed to process file ${file.id}: ${fileResult.error.message}`);
          continue; // Skip failed files but continue processing others
        }

        const fileRows = fileResult.value;
        allRows.push(...fileRows);
        totalRows += fileRows.length;

        // Respect limit hint if provided
        if (limitHint && totalRows >= limitHint) {
          truncated = true;
          allRows.splice(limitHint); // Keep only first limitHint rows
          totalRows = limitHint;
          break;
        }
      }

      const schemaData: SchemaData = {
        columns,
        rows: allRows,
        totalRows,
        truncated,
      };

      this.logger.debug(
        `Successfully processed ${files.length} files, returning ${totalRows} rows`,
      );
      return success(schemaData);
    } catch (error) {
      this.logger.error("Failed to process Delta files:", error);
      return failure(AppError.internal("Failed to process Delta Sharing data"));
    }
  }

  /**
   * Read a local parquet file from disk
   * Used by mock controller for local development
   */
  async readLocalParquetFile(
    filePath: string,
    options?: ParquetReadOptions,
  ): Promise<Result<SchemaData>> {
    try {
      this.logger.debug(`Reading local parquet file: ${filePath}`);

      const { readFileSync } = await import("fs");
      const buffer = readFileSync(filePath);
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      );

      const { parquetReadObjects, parquetMetadata } = await import("hyparquet");
      const { compressors } = await import("hyparquet-compressors");

      // Read metadata first to extract column info
      const metadata = parquetMetadata(arrayBuffer) as {
        schema: ParquetSchemaNode[];
        num_rows: bigint;
      };

      // Extract only top-level columns with proper type names
      const allColumns = this.extractTopLevelColumns(metadata.schema);

      const columnsFilter = options?.columns;
      const columns = columnsFilter
        ? allColumns.filter((c) => columnsFilter.includes(c.name))
        : allColumns;

      const objects = (await parquetReadObjects({
        file: arrayBuffer,
        columns: columnsFilter,
        rowStart: options?.rowStart,
        rowEnd: options?.rowEnd,
        compressors,
        // Keep BYTE_ARRAY as Uint8Array so variant decoder receives raw bytes
        utf8: false,
      })) as Record<string, unknown>[];

      // Detect and decode Databricks VARIANT columns (stored as {value, metadata} byte pairs)
      const variantCols = this.detectVariantColumns(metadata.schema);
      if (variantCols.size > 0) {
        await this.decodeVariantRows(objects, variantCols);
      }

      // Convert remaining Uint8Array fields to strings (non-variant BYTE_ARRAY columns)
      this.convertBytesToStrings(objects);

      const totalRows = Number(metadata.num_rows);
      const truncated =
        options?.rowEnd !== undefined ? (options.rowEnd ?? totalRows) < totalRows : false;

      return success({
        columns,
        rows: objects,
        totalRows,
        truncated,
      });
    } catch (error) {
      this.logger.error(`Failed to read local parquet file: ${filePath}`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return failure(AppError.internal(`Failed to read local parquet file: ${errorMessage}`));
    }
  }

  /**
   * Download and parse a single Parquet file using hyparquet
   * Returns native Parquet data objects without type conversion
   */
  private async downloadAndParseParquetFile(
    file: DeltaFile,
    options?: ParquetReadOptions,
  ): Promise<Result<Record<string, unknown>[]>> {
    try {
      this.logger.debug(`Downloading and parsing file: ${file.id} from ${file.url}`);

      // Download the Parquet file
      const response = await this.httpService.axiosRef.get(file.url, {
        responseType: "arraybuffer",
        timeout: this.configService.getRequestTimeout(),
      });

      const arrayBuffer = response.data as ArrayBuffer;

      const { parquetReadObjects } = await import("hyparquet");
      const { compressors } = await import("hyparquet-compressors");

      // Parse Parquet file using hyparquet with compressors and column selection
      const objects = (await parquetReadObjects({
        file: arrayBuffer,
        columns: options?.columns,
        rowStart: options?.rowStart,
        rowEnd: options?.rowEnd,
        compressors,
        // Keep BYTE_ARRAY as Uint8Array so variant decoder receives raw bytes
        utf8: false,
      })) as Record<string, unknown>[];

      this.logger.debug(`Successfully parsed file ${file.id}: ${objects.length} rows`);

      // Best-effort variant decoding for remote files
      try {
        const { parquetMetadata } = await import("hyparquet");
        const fileMeta = parquetMetadata(arrayBuffer) as { schema: ParquetSchemaNode[] };
        const variantCols = this.detectVariantColumns(fileMeta.schema);
        if (variantCols.size > 0) {
          await this.decodeVariantRows(objects, variantCols);
        }
        // Convert remaining Uint8Array fields to strings
        this.convertBytesToStrings(objects);
      } catch {
        // Non-critical: variant columns will stay as raw bytes
      }

      return success(objects);
    } catch (error) {
      this.logger.error(`Failed to download/parse file ${file.id}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return failure(AppError.internal(`Failed to process file ${file.id}: ${errorMessage}`));
    }
  }

  /**
   * Estimate total rows from file stats
   */
  estimateTotalRows(files: DeltaFile[]): number {
    let totalRows = 0;

    for (const file of files) {
      if (file.stats) {
        try {
          const stats = JSON.parse(file.stats) as { numRecords?: number };
          if (stats.numRecords) {
            totalRows += stats.numRecords;
          }
        } catch {
          // Ignore parsing errors, continue with other files
        }
      }
    }

    return totalRows;
  }

  /**
   * Apply limit hint to files (best effort)
   * Select files until we have enough estimated rows
   */
  applyLimitHint(files: DeltaFile[], limitHint: number): DeltaFile[] {
    if (!limitHint || limitHint <= 0) {
      return files;
    }

    const selectedFiles: DeltaFile[] = [];
    let estimatedRows = 0;

    for (const file of files) {
      selectedFiles.push(file);

      if (file.stats) {
        try {
          const stats = JSON.parse(file.stats) as { numRecords?: number };
          if (stats.numRecords) {
            estimatedRows += stats.numRecords;
            if (estimatedRows >= limitHint) {
              break;
            }
          }
        } catch {
          // Continue with next file if stats parsing fails
        }
      }
    }

    return selectedFiles;
  }

  /**
   * Detect top-level columns that are Databricks VARIANT columns.
   *
   * Detection uses two strategies (checked in order):
   *   1. **Annotation** — `logical_type.type === "VARIANT"` (future: when
   *      Databricks serverless enables `spark.sql.parquet.enableVariantLogicalType`).
   *   2. **Heuristic** — a group with exactly 2 BYTE_ARRAY children named
   *      `value` and `metadata`, which is the physical VARIANT encoding.
   *
   * The heuristic is required today because Databricks (DBR 18.x, serverless)
   * writes VariantType columns without the Parquet VARIANT annotation.
   *
   * @returns Set of column names that should be variant-decoded.
   */
  private detectVariantColumns(schema: ParquetSchemaNode[]): Set<string> {
    const variantCols = new Set<string>();
    const root = schema[0];
    if (!root.num_children) return variantCols;

    let idx = 1;
    for (let col = 0; col < root.num_children; col++) {
      const node = schema[idx];

      // Strategy 1: explicit VARIANT annotation (future Databricks versions)
      const hasAnnotation = node.logical_type?.type === "VARIANT";

      // Strategy 2: heuristic — group{ value: BYTE_ARRAY, metadata: BYTE_ARRAY }
      const looksLikeVariant =
        node.num_children === 2 &&
        !node.type &&
        schema[idx + 1]?.name === "value" &&
        schema[idx + 1]?.type === "BYTE_ARRAY" &&
        schema[idx + 2]?.name === "metadata" &&
        schema[idx + 2]?.type === "BYTE_ARRAY";

      if (hasAnnotation || looksLikeVariant) {
        variantCols.add(node.name);
      }

      idx = this.skipSchemaChildren(schema, idx);
    }
    return variantCols;
  }

  /**
   * Decode VARIANT columns in-place using hyparquet's variant decoder.
   *
   * If hyparquet already auto-decoded a column (future: via VARIANT annotation),
   * the value will be a native object rather than a `{value, metadata}` byte pair,
   * and `decodeVariantColumn` is a safe no-op.
   */
  private async decodeVariantRows(
    rows: Record<string, unknown>[],
    variantCols: Set<string>,
  ): Promise<void> {
    const { decodeVariantColumn } = await variantImport;
    for (const row of rows) {
      for (const col of variantCols) {
        const cell = row[col];
        if (cell == null) continue;

        // Skip if hyparquet already decoded this (annotation path)
        if (typeof cell !== "object" || !(cell as Record<string, unknown>).value) continue;

        row[col] = decodeVariantColumn(cell);
      }
    }
  }

  private static readonly textDecoder = new TextDecoder();

  /**
   * Recursively convert any remaining Uint8Array values to strings.
   * Needed because utf8:false keeps all BYTE_ARRAY columns as Uint8Array;
   * after variant decoding, the non-variant byte arrays should become strings.
   */
  private convertBytesToStrings(rows: Record<string, unknown>[]): void {
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        row[key] = this.coerceBytes(row[key]);
      }
    }
  }

  /**
   * Recursively coerce non-JSON-safe values produced by hyparquet:
   * - Uint8Array → string (leftover BYTE_ARRAY columns after variant decode)
   * - BigInt → number (variant decoder returns BigInt for INT64)
   */
  private coerceBytes(value: unknown): unknown {
    if (value instanceof Uint8Array) {
      return DeltaDataService.textDecoder.decode(value);
    }
    if (typeof value === "bigint") {
      return Number(value);
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.coerceBytes(v));
    }
    if (value !== null && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        obj[key] = this.coerceBytes(obj[key]);
      }
    }
    return value;
  }

  /**
   * Walk the parquet schema tree and extract only top-level columns.
   * Maps physical parquet types to friendly type names using logical/converted types.
   */
  private extractTopLevelColumns(
    schema: ParquetSchemaNode[],
  ): { name: string; type_name: string; type_text: string; position: number }[] {
    const root = schema[0] as ParquetSchemaNode | undefined;
    if (!root?.num_children) return [];

    const columns: { name: string; type_name: string; type_text: string; position: number }[] = [];
    let idx = 1; // skip root

    for (let col = 0; col < root.num_children; col++) {
      const node = schema[idx];
      const typeName = this.resolveTypeName(node);
      columns.push({
        name: node.name,
        type_name: typeName,
        type_text: typeName,
        position: col,
      });
      // Skip over this node and all its descendants
      idx = this.skipSchemaChildren(schema, idx);
    }

    return columns;
  }

  /**
   * Resolve the user-friendly type name for a parquet schema node.
   * Prefers logical_type > converted_type > mapped physical type.
   */
  private resolveTypeName(node: ParquetSchemaNode): string {
    if (node.logical_type?.type) {
      return node.logical_type.type;
    }
    if (node.converted_type) {
      return node.converted_type;
    }
    // Groups without a converted_type — distinguish VARIANT from plain STRUCT
    if (node.num_children !== undefined && !node.type) {
      if (node.logical_type?.type === "VARIANT") return "VARIANT";
      return "STRUCT";
    }
    // Map raw physical types to friendlier names
    switch (node.type) {
      case "BYTE_ARRAY":
        return "STRING";
      case "INT96":
        return "TIMESTAMP";
      case "INT32":
        return "INTEGER";
      case "INT64":
        return "LONG";
      case "FLOAT":
        return "FLOAT";
      case "DOUBLE":
        return "DOUBLE";
      case "BOOLEAN":
        return "BOOLEAN";
      case "FIXED_LEN_BYTE_ARRAY":
        return "BINARY";
      default:
        return node.type ?? "UNKNOWN";
    }
  }

  /**
   * Advance the index past a schema node and all its descendants.
   */
  private skipSchemaChildren(schema: ParquetSchemaNode[], idx: number): number {
    const node = schema[idx];
    idx++;
    if (node.num_children) {
      for (let i = 0; i < node.num_children; i++) {
        idx = this.skipSchemaChildren(schema, idx);
      }
    }
    return idx;
  }
}

/**
 * Shape of a single node in the parquet file metadata schema array.
 */
interface ParquetSchemaNode {
  name: string;
  type?: string;
  num_children?: number;
  converted_type?: string;
  repetition_type?: string;
  logical_type?: { type: string };
}
