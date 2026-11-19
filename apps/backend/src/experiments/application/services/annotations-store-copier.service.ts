import { Injectable } from "@nestjs/common";

import type { Result } from "../../../common/utils/fp-utils";
import type { AnnotationCopy } from "../../core/models/experiment-data-annotation.model";
import type { CopyKey } from "../../core/models/experiment-data-outbox.model";
import { ExperimentAnnotationsStoreRepository } from "../../core/repositories/experiment-annotations-store.repository";
import { ExperimentAnnotationsRepository } from "../../core/repositories/experiment-annotations.repository";
import { ExperimentDataCopierService } from "./experiment-data-copier.service";

/** Annotations go in one insert: a claim's worth is small. */
@Injectable()
export class AnnotationsStoreCopierService extends ExperimentDataCopierService<AnnotationCopy> {
  constructor(
    private readonly annotations: ExperimentAnnotationsRepository,
    private readonly store: ExperimentAnnotationsStoreRepository,
  ) {
    super();
  }

  protected find(ids: string[]): Promise<Result<AnnotationCopy[]>> {
    return this.annotations.findCopies(ids);
  }

  protected async merge(
    records: AnnotationCopy[],
    _canContinue: () => boolean,
    claimedAt: Date,
  ): Promise<Result<"merged" | "stopped">> {
    const merged = await this.store.merge(records, claimedAt);
    return merged.map((): "merged" => "merged");
  }

  protected remove(gone: CopyKey[], claimedAt: Date): Promise<Result<void>> {
    return this.store.delete(gone, claimedAt);
  }
}
