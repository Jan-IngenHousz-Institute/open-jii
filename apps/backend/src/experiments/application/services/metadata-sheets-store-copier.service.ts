import { Injectable } from "@nestjs/common";

import { Result, success } from "../../../common/utils/fp-utils";
import type { CopyKey } from "../../core/models/experiment-data-outbox.model";
import type { MetadataSheetRecord } from "../../core/models/experiment-metadata.model";
import { ExperimentMetadataStoreRepository } from "../../core/repositories/experiment-metadata-store.repository";
import { ExperimentMetadataRepository } from "../../core/repositories/experiment-metadata.repository";
import { ExperimentDataCopierService } from "./experiment-data-copier.service";

@Injectable()
export class MetadataSheetsStoreCopierService extends ExperimentDataCopierService<MetadataSheetRecord> {
  constructor(
    private readonly sheets: ExperimentMetadataRepository,
    private readonly store: ExperimentMetadataStoreRepository,
  ) {
    super();
  }

  /**
   * Sheets are grouped by their size, so only one insert's documents are read at once, and the
   * sheets that are gone make a group of their own.
   */
  override async groupsOf(owed: CopyKey[]): Promise<Result<CopyKey[][]>> {
    const sizes = await this.sheets.findSizes(owed.map(({ id }) => id));
    if (sizes.isFailure()) {
      return sizes;
    }

    const byId = new Map(owed.map((key) => [key.id, key]));
    const groups = this.store
      .statementGroups(sizes.value)
      .map((ids) => ids.flatMap((id) => byId.get(id) ?? []));
    const gone = this.gone(owed, sizes.value);
    return success(gone.length > 0 ? [...groups, gone] : groups);
  }

  protected find(ids: string[]): Promise<Result<MetadataSheetRecord[]>> {
    return this.sheets.findByIds(ids);
  }

  protected merge(
    records: MetadataSheetRecord[],
    canContinue: () => boolean,
    claimedAt: Date,
  ): Promise<Result<"merged" | "stopped">> {
    return this.store.merge(records, canContinue, claimedAt);
  }

  protected remove(gone: CopyKey[], claimedAt: Date): Promise<Result<void>> {
    return this.store.delete(gone, claimedAt);
  }
}
