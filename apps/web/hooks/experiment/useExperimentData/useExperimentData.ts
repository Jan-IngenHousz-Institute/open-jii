import type { AccessorKeyColumnDef, Row } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import type React from "react";
import { useMemo } from "react";
import type { AnnotationsRowIdentifier } from "~/components/experiment-data/annotations/utils";
import { getAnnotationsColumn } from "~/components/experiment-data/annotations/utils";
//import { addDemoAnnotationData } from "~/hooks/experiment/useExperimentData/addDemoAnnotationData";
import { tsr } from "~/lib/tsr";

import type { Annotation, AnnotationFlagType, AnnotationType, ExperimentData } from "@repo/api";

export type DataRow = Record<string, unknown>;
export type DataRenderFunction = (
  value: unknown,
  type: string,
  columnName?: string,
  onChartHover?: (data: number[], columnName: string) => void,
  onChartLeave?: () => void,
  onChartClick?: (data: number[], columnName: string) => void,
) => string | React.JSX.Element;

export interface AnnotationData {
  annotations: Annotation[];
  annotationsPerType: Record<AnnotationType, Annotation[]>;
  uniqueFlags: Set<AnnotationFlagType>;
  count: number;
  commentCount: number;
  flagCount: number;
}

export function getAnnotationData(annotations: Annotation[]): AnnotationData {
  const { annotationsPerType, uniqueFlags } = annotations.reduce(
    (acc, annotation) => {
      if (!(annotation.type in acc.annotationsPerType)) {
        acc.annotationsPerType[annotation.type] = [];
      }
      acc.annotationsPerType[annotation.type].push(annotation);
      if (annotation.type === "flag" && "flagType" in annotation.content) {
        acc.uniqueFlags.add(annotation.content.flagType);
      }
      return acc;
    },
    {
      annotationsPerType: {} as Record<AnnotationType, Annotation[]>,
      uniqueFlags: new Set<AnnotationFlagType>(),
    },
  );

  const count = annotations.length;
  const commentCount = "comment" in annotationsPerType ? annotationsPerType.comment.length : 0;
  const flagCount = "flag" in annotationsPerType ? annotationsPerType.flag.length : 0;

  return { annotations, annotationsPerType, uniqueFlags, count, commentCount, flagCount };
}

// Time in ms before data is removed from the cache
const STALE_TIME = 2 * 60 * 1000;

// ID column name
const ID_COLUMN_NAME = "id";

export function getColumnWidth(typeName: string): number | undefined {
  // Set very small width for id column to accommodate checkboxes
  if (typeName === "ID") return 30;
  // Set smaller width for array columns that contain charts
  if (typeName === "ARRAY" || typeName.startsWith("ARRAY<")) return 120;
  // Set medium width for map columns that contain collapsible content
  if (typeName === "MAP" || typeName.startsWith("MAP<STRING,")) return 200;
  return undefined;
}

interface CreateTableColumnsParams {
  experimentId: string;
  tableName?: string;
  data: ExperimentData | undefined;
  formatFunction?: DataRenderFunction;
  onChartHover?: (data: number[], columnName: string) => void;
  onChartLeave?: () => void;
  onChartClick?: (data: number[], columnName: string) => void;
}

function createTableColumns({
  experimentId,
  tableName,
  data,
  formatFunction,
  onChartHover,
  onChartLeave,
  onChartClick,
}: CreateTableColumnsParams) {
  const columnHelper = createColumnHelper<DataRow>();

  const columns: AccessorKeyColumnDef<DataRow, unknown>[] = [];
  if (!data) return columns;

  // Define type precedence for sorting
  const getTypePrecedence = (typeName: string): number => {
    switch (typeName) {
      case "ID":
        return 1;
      case "ANNOTATIONS":
        return 2;
      case "TIMESTAMP":
        return 3;
      case "STRING":
        return 5;
      case "DOUBLE":
      case "INT":
      case "LONG":
      case "BIGINT":
        return 6;
      default:
        if (typeName === "MAP" || typeName.startsWith("MAP<")) return 4;
        if (typeName === "ARRAY" || typeName.startsWith("ARRAY<")) return 7;
        return 8; // Other types at the end
    }
  };

  // Sort columns by type precedence
  const sortedColumns = [...data.columns].sort((a, b) => {
    const precedenceA = getTypePrecedence(a.type_name);
    const precedenceB = getTypePrecedence(b.type_name);
    return precedenceA - precedenceB;
  });

  function getHeader(typeName: string, columnName: string) {
    if (typeName === "ID") return () => "X";
    return columnName;
  }

  function getRow(typeName: string, columnName: string, row: Row<DataRow>) {
    // ID column shows a checkbox
    if (typeName === "ID") {
      // TODO: Change into checkbox for bulk actions
      return "X";
    }

    const value = row.getValue(columnName);

    // Annotations column shows the annotations component
    if (typeName === "ANNOTATIONS") {
      const rowId = row.getValue(ID_COLUMN_NAME);
      if (rowId && tableName) {
        const commentRowId: AnnotationsRowIdentifier = {
          experimentId,
          tableName,
          rowId: rowId as string,
        };
        return getAnnotationsColumn(
          commentRowId,
          getAnnotationData(Array.isArray(value) ? (value as Annotation[]) : []),
        );
      }
      return value as string;
    }

    // Regular data column is formatted using the provided function
    if (formatFunction) {
      return formatFunction(value, typeName, columnName, onChartHover, onChartLeave, onChartClick);
    }
    return value as string;
  }

  sortedColumns.forEach((dataColumn) => {
    columns.push(
      columnHelper.accessor(dataColumn.name, {
        header: getHeader(dataColumn.type_name, dataColumn.name),
        size: getColumnWidth(dataColumn.type_name),
        meta: {
          type: dataColumn.type_name,
        },
        cell: ({ row }) => {
          return getRow(dataColumn.type_name, dataColumn.name, row);
        },
      }),
    );
  });
  return columns;
}

export interface TableMetadata {
  columns: AccessorKeyColumnDef<DataRow, unknown>[];
  totalRows: number;
  totalPages: number;
}

/**
 * Hook to fetch experiment data by ID using regular pagination
 * @param experimentId The ID of the experiment to fetch
 * @param tableName Name of the table to fetch
 * @param page Page to fetch; pages start with 1
 * @param pageSize Page size to fetch
 * @param formatFunction Function used to render the column value
 * @param onChartHover Event handler for when a chart is hovered
 * @param onChartLeave Event handler for when a chart is no longer hovered
 * @param onChartClick Event handler for when a chart is clicked
 * @returns Query result containing the experiment data
 */
export const useExperimentData = (
  experimentId: string,
  page: number,
  pageSize: number,
  tableName: string,
  formatFunction?: DataRenderFunction,
  onChartHover?: (data: number[], columnName: string) => void,
  onChartLeave?: () => void,
  onChartClick?: (data: number[], columnName: string) => void,
) => {
  const { data, isLoading, error } = tsr.experiments.getExperimentData.useQuery({
    queryData: {
      params: { id: experimentId },
      query: { tableName, page, pageSize },
    },
    queryKey: ["experiment", experimentId, page, pageSize, tableName],
    staleTime: STALE_TIME,
  });

  // Add fake data for demo purposes
  // const originalTableData = data?.body[0];
  // const tableData = useMemo(() => {
  //   if (originalTableData?.data) {
  //     // Add fake id columns to each row if not present
  //     addDemoAnnotationData(originalTableData.data);
  //   }
  //   return originalTableData;
  // }, [originalTableData]);
  const tableData = data?.body[0];

  const tableMetadata: TableMetadata | undefined = useMemo(() => {
    return tableData
      ? {
          columns: createTableColumns({
            experimentId,
            tableName,
            data: tableData.data,
            formatFunction,
            onChartHover,
            onChartLeave,
            onChartClick,
          }),
          totalPages: tableData.totalPages,
          totalRows: tableData.totalRows,
        }
      : undefined;
  }, [
    experimentId,
    tableName,
    tableData,
    formatFunction,
    onChartHover,
    onChartLeave,
    onChartClick,
  ]);
  const tableRows: DataRow[] | undefined = tableData?.data?.rows;

  return { tableMetadata, tableRows, isLoading, error };
};

export interface SampleTable {
  name: string;
  tableMetadata: TableMetadata;
  tableRows: DataRow[];
}

/**
 * Hook to fetch experiment sample data by ID
 * @param experimentId The ID of the experiment to fetch
 * @param sampleSize Number of sample rows to fetch
 * @param formatFunction Function used to render the column value
 * @returns Query result containing the experiment sample data
 */
export const useExperimentSampleData = (
  experimentId: string,
  sampleSize = 5,
  formatFunction?: DataRenderFunction,
) => {
  const page = 1;
  const pageSize = sampleSize;
  const tableName = undefined;
  const { data, isLoading, error } = tsr.experiments.getExperimentData.useQuery({
    queryData: {
      params: { id: experimentId },
      query: { tableName, page, pageSize },
    },
    queryKey: ["experiment", experimentId, page, pageSize, tableName],
    staleTime: STALE_TIME,
  });

  const sampleTables = useMemo(() => {
    const tables: SampleTable[] = [];
    if (!data) return tables;
    data.body.forEach((tableData) => {
      tables.push({
        name: tableData.name,
        tableMetadata: {
          columns: createTableColumns({ experimentId, data: tableData.data, formatFunction }),
          totalPages: tableData.totalPages,
          totalRows: tableData.totalRows,
        } as TableMetadata,
        tableRows: tableData.data?.rows ?? [],
      });
    });
    return tables;
  }, [experimentId, data, formatFunction]);

  return { sampleTables, isLoading, error };
};
