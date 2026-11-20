import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { VariantSchema } from "../../../common/modules/databricks/services/query-builder/schema/variant-schema";
import { success } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import type { ExperimentTableMetadata } from "../../core/models/experiment-data.model";
import { SERVING_STORE_PORT } from "../../core/ports/serving-store.port";
import type { ServingStorePort, StoreMetadataSheet } from "../../core/ports/serving-store.port";

/**
 * Gold types an experiment's custom metadata from every row of its metadata sheets. The store
 * holds each sheet's schema apart, as the feed sends it, so a store read joins them for the tables
 * the sheets match.
 */
@Injectable()
export class CustomMetadataService {
  constructor(@Inject(SERVING_STORE_PORT) private readonly store: ServingStorePort) {}

  async typed(
    experimentId: string,
    tables: ExperimentTableMetadata[],
  ): Promise<Result<ExperimentTableMetadata[]>> {
    const takesMetadata = tables.some((table) => this.takesMetadata(table));
    if (!takesMetadata) {
      return success(tables);
    }

    const sheets = await this.sheets(experimentId);
    if (sheets.isFailure()) {
      return sheets;
    }
    if (sheets.value.length === 0) {
      return success(tables);
    }

    const schema = VariantSchema.mergeKeepingDecimals(
      sheets.value.flatMap((sheet) => sheet.schema ?? []),
    );
    const sheetsRevision = createHash("md5")
      .update(sheets.value.map(({ id, version }) => `${id}@${version}`).join(","))
      .digest("hex");
    return success(tables.map((table) => this.withSheets(table, schema, sheetsRevision)));
  }

  /** The experiment's sheets, oldest first, which a read of custom metadata joins. */
  sheets(experimentId: string): Promise<Result<StoreMetadataSheet[]>> {
    return this.store.getMetadataSheets(experimentId);
  }

  private takesMetadata(table: ExperimentTableMetadata): boolean {
    return this.store.takesCustomMetadata(table.tableType, table.identifier);
  }

  /** The revision moves with every sheet the store takes, so an open page reads a sheet's values
   *  once its rows land, not when Postgres saves it. */
  private withSheets(
    table: ExperimentTableMetadata,
    schema: string | null,
    sheetsRevision: string,
  ): ExperimentTableMetadata {
    if (!this.takesMetadata(table)) {
      return table;
    }
    return {
      ...table,
      customMetadataSchema: schema,
      schemaRevision: `${table.schemaRevision ?? ""}:${sheetsRevision}`,
    };
  }
}
