import { Injectable, Inject } from "@nestjs/common";

import type { StatementParameter } from "../../../common/modules/databricks/services/sql/sql.types";
import { AppError, failure, Result, success } from "../../../common/utils/fp-utils";
import type { AnnotationCopy } from "../models/experiment-data-annotation.model";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";

/**
 * The lakehouse's copy of annotations, `centrum.experiment_annotations`, which the warehouse views,
 * charts and exports read until they leave Databricks. Postgres holds the annotations; the
 * experiment data outbox keeps this copy to its state.
 */
@Injectable()
export class ExperimentAnnotationsWarehouseRepository {
  constructor(
    @Inject(DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  /** Writes each annotation as Postgres holds it, inserting the ones the copy lacks. */
  async merge(annotations: AnnotationCopy[]): Promise<Result<void>> {
    if (annotations.length === 0) {
      return success(undefined);
    }

    const parameters: StatementParameter[] = [];
    const rows = annotations.map((annotation, i) => {
      parameters.push(
        { name: `id_${i}`, value: annotation.id },
        { name: `experiment_id_${i}`, value: annotation.experimentId },
        { name: `user_id_${i}`, value: annotation.createdBy },
        { name: `user_name_${i}`, value: annotation.userName ?? undefined },
        { name: `table_name_${i}`, value: annotation.tableName },
        { name: `row_id_${i}`, value: annotation.rowId },
        { name: `type_${i}`, value: annotation.type },
        { name: `content_text_${i}`, value: annotation.contentText ?? undefined },
        { name: `flag_type_${i}`, value: annotation.flagType ?? undefined },
        { name: `created_at_${i}`, value: annotation.createdAt.toISOString(), type: "TIMESTAMP" },
        { name: `updated_at_${i}`, value: annotation.updatedAt.toISOString(), type: "TIMESTAMP" },
      );
      return `(:id_${i}, :experiment_id_${i}, :user_id_${i}, CAST(:user_name_${i} AS STRING), :table_name_${i}, :row_id_${i}, :type_${i}, CAST(:content_text_${i} AS STRING), CAST(:flag_type_${i} AS STRING), :created_at_${i}, :updated_at_${i})`;
    });

    const statement = `
      MERGE INTO experiment_annotations AS target
      USING (
        SELECT * FROM VALUES ${rows.join(", ")}
        AS copy(id, experiment_id, user_id, user_name, table_name, row_id, type, content_text, flag_type, created_at, updated_at)
      ) AS source
      ON target.id = source.id
      WHEN MATCHED THEN UPDATE SET
        experiment_id = source.experiment_id, user_id = source.user_id, user_name = source.user_name,
        table_name = source.table_name, row_id = source.row_id, type = source.type,
        content_text = source.content_text, flag_type = source.flag_type,
        created_at = source.created_at, updated_at = source.updated_at
      WHEN NOT MATCHED THEN INSERT
        (id, experiment_id, user_id, user_name, table_name, row_id, type, content_text, flag_type, created_at, updated_at)
        VALUES (source.id, source.experiment_id, source.user_id, source.user_name, source.table_name, source.row_id,
                source.type, source.content_text, source.flag_type, source.created_at, source.updated_at)
    `;

    return this.execute(statement, parameters, "merge annotations");
  }

  /** Deletes the copies of annotations Postgres no longer holds. */
  async delete(ids: string[]): Promise<Result<void>> {
    if (ids.length === 0) {
      return success(undefined);
    }

    const parameters = ids.map((id, i) => ({ name: `id_${i}`, value: id }));
    const statement = `
      DELETE FROM experiment_annotations
      WHERE id IN (${parameters.map(({ name }) => `:${name}`).join(", ")})
    `;

    return this.execute(statement, parameters, "delete annotations");
  }

  private async execute(
    statement: string,
    parameters: StatementParameter[],
    what: string,
  ): Promise<Result<void>> {
    const result = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      statement,
      parameters,
    );
    if (result.isFailure()) {
      return failure(AppError.internal(`Failed to ${what}: ${result.error.message}`));
    }

    return success(undefined);
  }
}
