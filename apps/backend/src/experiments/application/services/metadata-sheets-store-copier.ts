import { Inject, Injectable } from "@nestjs/common";

import { Result, success } from "../../../common/utils/fp-utils";
import type { CopyKey } from "../../core/models/experiment-data-outbox.model";
import type { MetadataSheetRecord } from "../../core/models/experiment-metadata.model";
import { SERVING_STORE_COPIES_PORT } from "../../core/ports/serving-store-copies.port";
import type { ServingStoreCopiesPort } from "../../core/ports/serving-store-copies.port";
import { ExperimentMetadataRepository } from "../../core/repositories/experiment-metadata.repository";
import { ExperimentDataCopier } from "./experiment-data-copier";

/** The sheets' JSON one insert carries at most, since the client holds an insert's whole body. */
const INSERT_BYTES = 16 * 1024 * 1024;

@Injectable()
export class MetadataSheetsStoreCopier extends ExperimentDataCopier<MetadataSheetRecord> {
  constructor(
    private readonly sheets: ExperimentMetadataRepository,
    @Inject(SERVING_STORE_COPIES_PORT) private readonly store: ServingStoreCopiesPort,
  ) {
    super();
  }

  /** Sheets are grouped by their size, and the sheets that are gone make a group of their own. */
  override async groupsOf(owed: CopyKey[]): Promise<Result<CopyKey[][]>> {
    const sizes = await this.sheets.findSizes(owed.map(({ id }) => id));
    if (sizes.isFailure()) {
      return sizes;
    }

    const byId = new Map(owed.map((key) => [key.id, key]));
    const groups: CopyKey[][] = [];
    let current: CopyKey[] = [];
    let bytes = 0;
    for (const size of sizes.value) {
      const key = byId.get(size.id);
      if (key === undefined) {
        continue;
      }
      const isFull = current.length > 0 && bytes + size.bytes > INSERT_BYTES;
      if (isFull) {
        groups.push(current);
        current = [];
        bytes = 0;
      }
      current.push(key);
      bytes += size.bytes;
    }
    if (current.length > 0) {
      groups.push(current);
    }

    const gone = this.gone(owed, sizes.value);
    return success(gone.length > 0 ? [...groups, gone] : groups);
  }

  protected find(ids: string[]): Promise<Result<MetadataSheetRecord[]>> {
    return this.sheets.findByIds(ids);
  }

  protected write(
    records: MetadataSheetRecord[],
    canContinue: () => boolean,
    claimedAt: Date,
  ): Promise<Result<"written" | "stopped">> {
    return this.store.writeSheets(records, claimedAt, canContinue);
  }

  protected remove(gone: CopyKey[], claimedAt: Date): Promise<Result<void>> {
    return this.store.removeSheets(gone, claimedAt);
  }
}
