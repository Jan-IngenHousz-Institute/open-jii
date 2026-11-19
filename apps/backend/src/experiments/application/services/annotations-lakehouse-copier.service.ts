import { Injectable } from "@nestjs/common";

import type { Result } from "../../../common/utils/fp-utils";
import type { AnnotationCopy } from "../../core/models/experiment-data-annotation.model";
import { ExperimentAnnotationsWarehouseRepository } from "../../core/repositories/experiment-annotations-warehouse.repository";
import { ExperimentAnnotationsRepository } from "../../core/repositories/experiment-annotations.repository";
import { ExperimentDataLakehouseCopierService } from "./experiment-data-lakehouse-copier.service";

/** Annotations go in one statement: a claim's worth stays well under the warehouse's parameters. */
@Injectable()
export class AnnotationsLakehouseCopierService extends ExperimentDataLakehouseCopierService<AnnotationCopy> {
  constructor(
    private readonly annotations: ExperimentAnnotationsRepository,
    private readonly warehouse: ExperimentAnnotationsWarehouseRepository,
  ) {
    super();
  }

  protected find(ids: string[]): Promise<Result<AnnotationCopy[]>> {
    return this.annotations.findCopies(ids);
  }

  protected async merge(records: AnnotationCopy[]): Promise<Result<"merged" | "stopped">> {
    const merged = await this.warehouse.merge(records);
    return merged.map((): "merged" => "merged");
  }

  protected remove(ids: string[]): Promise<Result<void>> {
    return this.warehouse.delete(ids);
  }
}
