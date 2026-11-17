import { Injectable } from "@nestjs/common";

import { Result, success } from "../../../common/utils/fp-utils";
import type { CopyKey } from "../../core/models/experiment-data-outbox.model";
import type { MetadataSheetRecord } from "../../core/models/experiment-metadata.model";
import { ExperimentMetadataWarehouseRepository } from "../../core/repositories/experiment-metadata-warehouse.repository";
import { ExperimentMetadataRepository } from "../../core/repositories/experiment-metadata.repository";
import { ExperimentDataCopier } from "./experiment-data-copier";

@Injectable()
export class MetadataSheetsLakehouseCopier extends ExperimentDataCopier<MetadataSheetRecord> {
  constructor(
    private readonly sheets: ExperimentMetadataRepository,
    private readonly warehouse: ExperimentMetadataWarehouseRepository,
  ) {
    super();
  }

  /**
   * Sheets are grouped by their size, so only one statement's documents are read at once, and the
   * sheets that are gone make a group of their own.
   */
  override async groupsOf(owed: CopyKey[]): Promise<Result<CopyKey[][]>> {
    const sizes = await this.sheets.findSizes(owed.map(({ id }) => id));
    if (sizes.isFailure()) {
      return sizes;
    }

    const byId = new Map(owed.map((key) => [key.id, key]));
    const groups = this.warehouse
      .statementGroups(sizes.value)
      .map((ids) => ids.flatMap((id) => byId.get(id) ?? []));
    const gone = this.gone(owed, sizes.value);
    return success(gone.length > 0 ? [...groups, gone] : groups);
  }

  protected find(ids: string[]): Promise<Result<MetadataSheetRecord[]>> {
    return this.sheets.findByIds(ids);
  }

  protected async write(
    records: MetadataSheetRecord[],
    canContinue: () => boolean,
  ): Promise<Result<"written" | "stopped">> {
    const merged = await this.warehouse.merge(records, canContinue);
    return merged.map((outcome: "merged" | "stopped"): "written" | "stopped" =>
      outcome === "merged" ? "written" : outcome,
    );
  }

  protected remove(gone: CopyKey[]): Promise<Result<void>> {
    return this.warehouse.delete(gone.map(({ id }) => id));
  }
}
