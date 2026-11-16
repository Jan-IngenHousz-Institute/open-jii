import { Inject, Injectable } from "@nestjs/common";

import type { Result } from "../../../common/utils/fp-utils";
import type { AnnotationCopy } from "../../core/models/experiment-data-annotation.model";
import type { CopyKey } from "../../core/models/experiment-data-outbox.model";
import { SERVING_STORE_COPIES_PORT } from "../../core/ports/serving-store-copies.port";
import type { ServingStoreCopiesPort } from "../../core/ports/serving-store-copies.port";
import { ExperimentAnnotationsRepository } from "../../core/repositories/experiment-annotations.repository";
import { ExperimentDataCopier } from "./experiment-data-copier";

/** Annotations go in one insert: a claim's worth is small. */
@Injectable()
export class AnnotationsStoreCopier extends ExperimentDataCopier<AnnotationCopy> {
  constructor(
    private readonly annotations: ExperimentAnnotationsRepository,
    @Inject(SERVING_STORE_COPIES_PORT) private readonly store: ServingStoreCopiesPort,
  ) {
    super();
  }

  protected find(ids: string[]): Promise<Result<AnnotationCopy[]>> {
    return this.annotations.findCopies(ids);
  }

  protected async write(records: AnnotationCopy[]): Promise<Result<"written" | "stopped">> {
    const written = await this.store.writeAnnotations(records);
    return written.map((): "written" => "written");
  }

  protected remove(gone: CopyKey[]): Promise<Result<void>> {
    return this.store.removeAnnotations(gone);
  }
}
