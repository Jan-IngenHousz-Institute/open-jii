import { Injectable } from "@nestjs/common";

import type { Result } from "../../../common/utils/fp-utils";
import type { AnnotationCopy } from "../../core/models/experiment-data-annotation.model";
import { ExperimentAnnotationsWarehouseRepository } from "../../core/repositories/experiment-annotations-warehouse.repository";
import { ExperimentAnnotationsRepository } from "../../core/repositories/experiment-annotations.repository";
import { ExperimentDataLakehouseCopier } from "./experiment-data-lakehouse-copier";

/** Annotations go in one statement: a claim's worth stays well under the warehouse's parameters. */
@Injectable()
export class AnnotationsLakehouseCopier extends ExperimentDataLakehouseCopier<AnnotationCopy> {
  constructor(
    private readonly annotations: ExperimentAnnotationsRepository,
    private readonly warehouse: ExperimentAnnotationsWarehouseRepository,
  ) {
    super();
  }

  protected find(ids: string[]): Promise<Result<AnnotationCopy[]>> {
    return this.annotations.findCopies(ids);
  }

  protected merge(records: AnnotationCopy[]): Promise<Result<void>> {
    return this.warehouse.merge(records);
  }

  protected remove(ids: string[]): Promise<Result<void>> {
    return this.warehouse.delete(ids);
  }
}
