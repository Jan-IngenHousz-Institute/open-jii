import { Injectable } from "@nestjs/common";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { success } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import type { AnnotationCopy } from "../../core/models/experiment-data-annotation.model";
import { ExperimentAnnotationsRepository } from "../../core/repositories/experiment-annotations.repository";

const ROW_ID = "id";
const ANNOTATIONS = "annotations";

/**
 * Puts the platform's annotations, which Postgres holds, on each row of a read, after the phone's,
 * which travel with the measurement. Both read paths do it, so a page shows an annotation as soon
 * as it is written, whatever the lakehouse's copy is doing.
 */
@Injectable()
export class PlatformAnnotationsService {
  constructor(private readonly annotations: ExperimentAnnotationsRepository) {}

  /**
   * `phoneAnnotationsFrom` names the column holding the phone's annotations, or none when the table
   * has none. A column other than the annotations column itself is left out of what is returned.
   */
  async fill(params: {
    experimentId: string;
    tableName: string;
    data: SchemaData;
    phoneAnnotationsFrom?: string;
  }): Promise<Result<SchemaData>> {
    const { experimentId, tableName, data, phoneAnnotationsFrom } = params;
    const indexOf = (name: string | undefined) =>
      data.columns.findIndex((column) => column.name === name);
    const annotationsIndex = indexOf(ANNOTATIONS);
    const idIndex = indexOf(ROW_ID);
    const phoneIndex = indexOf(phoneAnnotationsFrom);
    const separatePhoneIndex = phoneAnnotationsFrom === ANNOTATIONS ? -1 : phoneIndex;
    const holdsPhoneAnnotations = phoneAnnotationsFrom === undefined || phoneIndex !== -1;
    // A read without the row ids or the phone's annotations, such as one joined to a second table,
    // keeps the warehouse's merged cell rather than lose half of it.
    const canFill = annotationsIndex !== -1 && idIndex !== -1 && holdsPhoneAnnotations;
    if (!canFill) {
      return success(this.without(data, separatePhoneIndex));
    }

    const rowIds = [...new Set(data.rows.map((row) => row[idIndex]).filter((id) => id !== null))];
    const found =
      rowIds.length === 0
        ? success([])
        : await this.annotations.findOnRows(experimentId, tableName, rowIds);
    if (found.isFailure()) {
      return found;
    }

    const onRow = new Map<string, AnnotationCopy[]>();
    for (const annotation of found.value) {
      onRow.set(annotation.rowId, [...(onRow.get(annotation.rowId) ?? []), annotation]);
    }

    const rows = data.rows.map((row) => {
      const phone = phoneIndex === -1 ? [] : this.parsed(row[phoneIndex]);
      const platform = (onRow.get(row[idIndex] ?? "") ?? []).map((annotation) =>
        this.cell(annotation),
      );
      return row.map((value, index) =>
        index === annotationsIndex ? JSON.stringify([...phone, ...platform]) : value,
      );
    });
    return success(this.without({ ...data, rows }, separatePhoneIndex));
  }

  /** In the order of the annotations column's type, and with its times, as both sources write it. */
  private cell(annotation: AnnotationCopy) {
    return {
      id: annotation.id,
      rowId: annotation.rowId,
      type: annotation.type,
      content: { text: annotation.contentText, flagType: annotation.flagType },
      createdBy: annotation.createdBy,
      createdByName: annotation.userName,
      createdAt: annotation.createdAt.toISOString(),
      updatedAt: annotation.updatedAt.toISOString(),
    };
  }

  private parsed(cell: string | null): unknown[] {
    if (cell === null) {
      return [];
    }
    try {
      const value: unknown = JSON.parse(cell);
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  private without(data: SchemaData, index: number): SchemaData {
    if (index === -1) {
      return data;
    }
    return {
      ...data,
      columns: data.columns.filter((_, at) => at !== index),
      rows: data.rows.map((row) => row.filter((_, at) => at !== index)),
    };
  }
}
