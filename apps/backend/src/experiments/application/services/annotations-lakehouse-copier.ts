import { Injectable } from "@nestjs/common";

import type { Result } from "../../../common/utils/fp-utils";
import type { AnnotationCopy } from "../../core/models/experiment-data-annotation.model";
import type { CopyKey } from "../../core/models/experiment-data-outbox.model";
import { ExperimentAnnotationsWarehouseRepository } from "../../core/repositories/experiment-annotations-warehouse.repository";
import { ExperimentAnnotationsRepository } from "../../core/repositories/experiment-annotations.repository";
import { ExperimentDataCopier } from "./experiment-data-copier";

/** Annotations go in one statement: a claim's worth stays well under the warehouse's parameters. */
@Injectable()
export class AnnotationsLakehouseCopier extends ExperimentDataCopier<AnnotationCopy> {
  constructor(
    private readonly annotations: ExperimentAnnotationsRepository,
    private readonly warehouse: ExperimentAnnotationsWarehouseRepository,
  ) {
    super();
  }

  protected find(ids: string[]): Promise<Result<AnnotationCopy[]>> {
    return this.annotations.findCopies(ids);
  }

  protected async write(records: AnnotationCopy[]): Promise<Result<"written" | "stopped">> {
    const merged = await this.warehouse.merge(records);
    return merged.map((): "written" => "written");
  }

  protected remove(gone: CopyKey[]): Promise<Result<void>> {
    return this.warehouse.delete(gone.map(({ id }) => id));
  }
}
