import type { SchemaData } from "../../../../common/modules/databricks/services/sql/sql.types";

export interface SchemaDataDto {
  columns: {
    name: string;
    type_name: string;
    type_text: string;
  }[];
  rows: Record<string, string | null>[];
  totalRows: number;
  truncated: boolean;
}

export abstract class DataTransformationService {
  abstract getSourceColumns(): string[];
  abstract getTargetColumn(): string;
  abstract getTargetType(): string;
  abstract canTransform(schemaData: SchemaData): boolean;
  abstract transformData(schemaData: SchemaData): Promise<SchemaDataDto>;

  protected convertToDto(
    columns: SchemaDataDto["columns"],
    rows: (string | null)[][],
    schemaData: SchemaData,
  ): SchemaDataDto {
    return {
      columns,
      rows: rows.map((row) => {
        const dataRow: Record<string, string | null> = {};
        row.forEach((value, index) => {
          if (columns[index]) {
            dataRow[columns[index].name] = value;
          }
        });
        return dataRow;
      }),
      totalRows: schemaData.totalRows,
      truncated: schemaData.truncated,
    };
  }
}
