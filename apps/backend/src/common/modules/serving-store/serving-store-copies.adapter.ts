import { Injectable, Logger } from "@nestjs/common";
import { z } from "zod";

import type { AnnotationCopy } from "../../../experiments/core/models/experiment-data-annotation.model";
import type { CopyKey } from "../../../experiments/core/models/experiment-data-outbox.model";
import type { MetadataSheetRecord } from "../../../experiments/core/models/experiment-metadata.model";
import type { ServingStoreCopiesPort } from "../../../experiments/core/ports/serving-store-copies.port";
import { success } from "../../utils/fp-utils";
import type { Result } from "../../utils/fp-utils";
import { ServingStoreCopierClientService } from "./services/client/copier-client.service";

/** A sheet's tombstones keep its key alone; FINAL drops them whatever their other fields say. */
const NO_TIME = "1970-01-01T00:00:00Z";

const zSheetShape = z.object({
  identifierColumnId: z.string(),
  experimentQuestionId: z.string(),
  rows: z.array(z.record(z.string(), z.unknown())),
});

const zHeldRow = z.object({ sheet_id: z.string(), identifier: z.string() });

interface SheetRow {
  experiment_id: string;
  sheet_id: string;
  sheet_created_at: string;
  match_on: string;
  identifier: string;
  fields: string;
  is_deleted: 0 | 1;
}

/**
 * Writes the store's copies of annotations and metadata sheet rows. A copy inserts each record's
 * current state, and a removal inserts a row FINAL leaves out, so nothing is ever updated in place.
 */
@Injectable()
export class ServingStoreCopiesAdapter implements ServingStoreCopiesPort {
  private readonly logger = new Logger(ServingStoreCopiesAdapter.name);

  constructor(private readonly client: ServingStoreCopierClientService) {}

  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  writeAnnotations(annotations: AnnotationCopy[]): Promise<Result<void>> {
    return this.client.insert(
      "annotations",
      annotations.map((annotation) => ({
        experiment_id: annotation.experimentId,
        id: annotation.id,
        table_name: annotation.tableName,
        row_id: annotation.rowId,
        type: annotation.type,
        flag_type: annotation.flagType,
        is_deleted: 0,
      })),
    );
  }

  removeAnnotations(gone: CopyKey[]): Promise<Result<void>> {
    return this.client.insert(
      "annotations",
      gone.map(({ experimentId, id }) => ({
        experiment_id: experimentId,
        id,
        table_name: "",
        row_id: "",
        type: "",
        is_deleted: 1,
      })),
    );
  }

  async writeSheets(sheets: MetadataSheetRecord[]): Promise<Result<void>> {
    const held = await this.heldIdentifiers(sheets);
    if (held.isFailure()) {
      return held;
    }

    const rows = sheets.flatMap((sheet) => {
      const current = this.rowsOf(sheet);
      const kept = new Set(current.map((row) => row.identifier));
      const removed = (held.value.get(sheet.id) ?? [])
        .filter((identifier) => !kept.has(identifier))
        .map((identifier) => this.tombstone(sheet, identifier));
      return [...current, ...removed];
    });
    return this.client.insert("metadata_rows", rows);
  }

  async removeSheets(gone: CopyKey[]): Promise<Result<void>> {
    const held = await this.heldIdentifiers(gone);
    if (held.isFailure()) {
      return held;
    }

    const rows = gone.flatMap((sheet) =>
      (held.value.get(sheet.id) ?? []).map((identifier) => this.tombstone(sheet, identifier)),
    );
    return this.client.insert("metadata_rows", rows);
  }

  /** The identifiers the store holds for each sheet, so an edit can remove the ones it dropped. */
  private async heldIdentifiers(sheets: CopyKey[]): Promise<Result<Map<string, string[]>>> {
    if (sheets.length === 0) {
      return success(new Map());
    }

    const held = await this.client.rows(
      "SELECT sheet_id, identifier FROM metadata_rows FINAL WHERE experiment_id IN {experiments:Array(String)} AND sheet_id IN {sheets:Array(String)}",
      {
        experiments: [...new Set(sheets.map(({ experimentId }) => experimentId))],
        sheets: sheets.map(({ id }) => id),
      },
      zHeldRow,
    );
    if (held.isFailure()) {
      return held;
    }

    const bySheet = new Map<string, string[]>();
    for (const { sheet_id, identifier } of held.value) {
      bySheet.set(sheet_id, [...(bySheet.get(sheet_id) ?? []), identifier]);
    }
    return success(bySheet);
  }

  /**
   * The sheet's rows as the warehouse views read them: matched by the identifier column's value as
   * text, the first row of each identifier winning, rows without one left out, and the rest of the
   * row, without its `_id`, as the fields. A sheet saved before its shape was checked has no rows.
   */
  private rowsOf(sheet: MetadataSheetRecord): SheetRow[] {
    const shape = zSheetShape.safeParse(sheet.metadata);
    if (!shape.success) {
      this.logger.warn({
        msg: "A metadata sheet has no rows the store can match by; it copies none",
        operation: "writeSheets",
        experimentId: sheet.experimentId,
        sheetId: sheet.id,
      });
      return [];
    }

    const { identifierColumnId, experimentQuestionId, rows } = shape.data;
    const seen = new Set<string>();
    const result: SheetRow[] = [];
    for (const row of rows) {
      const identifier = this.textOf(row[identifierColumnId]);
      if (identifier === null || seen.has(identifier)) {
        continue;
      }
      seen.add(identifier);

      const fields = Object.fromEntries(
        Object.entries(row).filter(([key]) => key !== "_id" && key !== identifierColumnId),
      );
      result.push({
        experiment_id: sheet.experimentId,
        sheet_id: sheet.id,
        sheet_created_at: sheet.createdAt.toISOString(),
        match_on: experimentQuestionId,
        identifier,
        fields: JSON.stringify(fields),
        is_deleted: 0,
      });
    }
    return result;
  }

  /** An identifier as the views read it, a value cast to text. */
  private textOf(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return JSON.stringify(value);
  }

  private tombstone(sheet: CopyKey, identifier: string): SheetRow {
    return {
      experiment_id: sheet.experimentId,
      sheet_id: sheet.id,
      sheet_created_at: NO_TIME,
      match_on: "",
      identifier,
      fields: "",
      is_deleted: 1,
    };
  }
}
