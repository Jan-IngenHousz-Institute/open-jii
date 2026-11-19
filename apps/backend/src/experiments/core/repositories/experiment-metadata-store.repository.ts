import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod";

import { Result, success } from "../../../common/utils/fp-utils";
import type { CopyKey } from "../models/experiment-data-outbox.model";
import type { MetadataSheetRecord } from "../models/experiment-metadata.model";
import { SERVING_STORE_PORT } from "../ports/serving-store.port";
import type { ServingStorePort } from "../ports/serving-store.port";

/** The sheets' JSON one insert carries at most, since the client holds an insert's whole body. */
const INSERT_BYTES = 16 * 1024 * 1024;

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
  claimed_at: string;
}

/**
 * The serving store's copy of metadata sheets, one row per identifier, which the experiment data
 * outbox keeps to Postgres. A removal inserts a row FINAL leaves out, and the claim's time versions
 * every row.
 */
@Injectable()
export class ExperimentMetadataStoreRepository {
  private readonly logger = new Logger(ExperimentMetadataStoreRepository.name);

  constructor(@Inject(SERVING_STORE_PORT) private readonly servingStore: ServingStorePort) {}

  /** The ids of the sheets each insert should carry, from their sizes. */
  statementGroups(sizes: { id: string; bytes: number }[]): string[][] {
    const groups: string[][] = [];
    let current: string[] = [];
    let bytes = 0;

    for (const sheet of sizes) {
      if (current.length > 0 && bytes + sheet.bytes > INSERT_BYTES) {
        groups.push(current);
        current = [];
        bytes = 0;
      }
      current.push(sheet.id);
      bytes += sheet.bytes;
    }

    if (current.length > 0) {
      groups.push(current);
    }
    return groups;
  }

  /** Writes each sheet's rows and removes the ones an edit took out, unless `canContinue` says no. */
  async merge(
    sheets: MetadataSheetRecord[],
    canContinue: () => boolean,
    claimedAt: Date,
  ): Promise<Result<"merged" | "stopped">> {
    const held = await this.heldIdentifiers(sheets);
    if (held.isFailure()) {
      return held;
    }

    const rows = sheets.flatMap((sheet) => {
      const current = this.rowsOf(sheet, claimedAt);
      const kept = new Set(current.map((row) => row.identifier));
      const removed = (held.value.get(sheet.id) ?? [])
        .filter((identifier) => !kept.has(identifier))
        .map((identifier) => this.tombstone(sheet, identifier, claimedAt));
      return [...current, ...removed];
    });
    // Reading the held rows and building a large sheet's rows can both outlast the claim.
    if (!canContinue()) {
      return success("stopped");
    }

    const inserted = await this.servingStore.insertRows("metadata_rows", rows);
    return inserted.map((): "merged" => "merged");
  }

  /** Removes the rows of sheets Postgres no longer holds. */
  async delete(gone: CopyKey[], claimedAt: Date): Promise<Result<void>> {
    const held = await this.heldIdentifiers(gone);
    if (held.isFailure()) {
      return held;
    }

    const rows = gone.flatMap((sheet) =>
      (held.value.get(sheet.id) ?? []).map((identifier) =>
        this.tombstone(sheet, identifier, claimedAt),
      ),
    );
    return this.servingStore.insertRows("metadata_rows", rows);
  }

  /** The identifiers the store holds for each sheet, so an edit can remove the ones it dropped. */
  private async heldIdentifiers(sheets: CopyKey[]): Promise<Result<Map<string, string[]>>> {
    if (sheets.length === 0) {
      return success(new Map());
    }

    const held = await this.servingStore.selectRows(
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
      const identifiers = bySheet.get(sheet_id);
      if (identifiers) {
        identifiers.push(identifier);
      } else {
        bySheet.set(sheet_id, [identifier]);
      }
    }
    return success(bySheet);
  }

  /**
   * The sheet's rows as the warehouse views match them: one per identifier as text, the first
   * winning, with the rest of the row except `_id` as its fields. A sheet saved before its shape was
   * checked has none.
   */
  private rowsOf(sheet: MetadataSheetRecord, claimedAt: Date): SheetRow[] {
    const shape = zSheetShape.safeParse(sheet.metadata);
    if (!shape.success) {
      this.logger.warn({
        msg: "A metadata sheet has no rows the store can match by; it copies none",
        operation: "merge",
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
        claimed_at: claimedAt.toISOString(),
      });
    }
    return result;
  }

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

  private tombstone(sheet: CopyKey, identifier: string, claimedAt: Date): SheetRow {
    return {
      experiment_id: sheet.experimentId,
      sheet_id: sheet.id,
      sheet_created_at: NO_TIME,
      match_on: "",
      identifier,
      fields: "",
      is_deleted: 1,
      claimed_at: claimedAt.toISOString(),
    };
  }
}
