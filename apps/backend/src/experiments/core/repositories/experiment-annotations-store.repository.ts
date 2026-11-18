import { Inject, Injectable } from "@nestjs/common";

import type { Result } from "../../../common/utils/fp-utils";
import type { AnnotationCopy } from "../models/experiment-data-annotation.model";
import type { CopyKey } from "../models/experiment-data-outbox.model";
import { SERVING_STORE_PORT } from "../ports/serving-store.port";
import type { ServingStorePort } from "../ports/serving-store.port";

/**
 * The serving store's copy of annotations, which store pages filter flags by, kept to Postgres by
 * the experiment data outbox. A removal inserts a row FINAL leaves out, and the claim's time
 * versions every row.
 */
@Injectable()
export class ExperimentAnnotationsStoreRepository {
  constructor(@Inject(SERVING_STORE_PORT) private readonly servingStore: ServingStorePort) {}

  merge(annotations: AnnotationCopy[], claimedAt: Date): Promise<Result<void>> {
    return this.servingStore.insertRows(
      "annotations",
      annotations.map((annotation) => ({
        experiment_id: annotation.experimentId,
        id: annotation.id,
        table_name: annotation.tableName,
        row_id: annotation.rowId,
        type: annotation.type,
        flag_type: annotation.flagType,
        is_deleted: 0,
        claimed_at: claimedAt.toISOString(),
      })),
    );
  }

  delete(gone: CopyKey[], claimedAt: Date): Promise<Result<void>> {
    return this.servingStore.insertRows(
      "annotations",
      gone.map(({ experimentId, id }) => ({
        experiment_id: experimentId,
        id,
        table_name: "",
        row_id: "",
        type: "",
        is_deleted: 1,
        claimed_at: claimedAt.toISOString(),
      })),
    );
  }
}
