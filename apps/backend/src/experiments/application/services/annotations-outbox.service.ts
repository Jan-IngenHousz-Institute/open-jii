import { Injectable } from "@nestjs/common";

import type { Result } from "../../../common/utils/fp-utils";
import type { AnnotationRecord } from "../../core/models/experiment-data-annotation.model";
import { ExperimentAnnotationsWarehouseRepository } from "../../core/repositories/experiment-annotations-warehouse.repository";
import { ExperimentAnnotationsRepository } from "../../core/repositories/experiment-annotations.repository";
import { ExperimentDataOutboxService } from "./experiment-data-outbox.service";

/** Annotations go in one statement: a claim's worth stays well under the warehouse's parameters. */
@Injectable()
export class AnnotationsOutboxService extends ExperimentDataOutboxService<AnnotationRecord> {
  constructor(
    private readonly annotations: ExperimentAnnotationsRepository,
    private readonly warehouse: ExperimentAnnotationsWarehouseRepository,
  ) {
    super();
  }

  protected find(ids: string[]): Promise<Result<AnnotationRecord[]>> {
    return this.annotations.findCopies(ids);
  }

  protected async merge(records: AnnotationRecord[]): Promise<Result<"merged" | "stopped">> {
    const merged = await this.warehouse.merge(records);
    return merged.map((): "merged" => "merged");
  }

  protected remove(ids: string[]): Promise<Result<void>> {
    return this.warehouse.delete(ids);
  }
}
