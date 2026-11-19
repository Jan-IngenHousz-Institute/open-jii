import { Injectable } from "@nestjs/common";

import { Result, success } from "../../../common/utils/fp-utils";
import type { MetadataSheetRecord } from "../../core/models/experiment-metadata.model";
import { ExperimentMetadataWarehouseRepository } from "../../core/repositories/experiment-metadata-warehouse.repository";
import { ExperimentMetadataRepository } from "../../core/repositories/experiment-metadata.repository";
import { ExperimentDataOutboxService } from "./experiment-data-outbox.service";

@Injectable()
export class MetadataSheetsOutboxService extends ExperimentDataOutboxService<MetadataSheetRecord> {
  constructor(
    private readonly sheets: ExperimentMetadataRepository,
    private readonly warehouse: ExperimentMetadataWarehouseRepository,
  ) {
    super();
  }

  /**
   * Sheets are grouped by their size, so only one statement's documents are read at once, and the
   * ids of sheets that are gone make a group of their own.
   */
  override async groupsOf(ids: string[]): Promise<Result<string[][]>> {
    const sizes = await this.sheets.findSizes(ids);
    if (sizes.isFailure()) {
      return sizes;
    }

    const groups = this.warehouse.statementGroups(sizes.value);
    const gone = this.gone(ids, sizes.value);
    return success(gone.length > 0 ? [...groups, gone] : groups);
  }

  protected find(ids: string[]): Promise<Result<MetadataSheetRecord[]>> {
    return this.sheets.findByIds(ids);
  }

  protected merge(
    records: MetadataSheetRecord[],
    canContinue: () => boolean,
  ): Promise<Result<"merged" | "stopped">> {
    return this.warehouse.merge(records, canContinue);
  }

  protected remove(ids: string[]): Promise<Result<void>> {
    return this.warehouse.delete(ids);
  }
}
