import type { AccessorKeyColumnDef, Row } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import type React from "react";
import { useEffect } from "react";
import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { AnnotationsRowIdentifier } from "~/components/experiment-data/annotations/utils";
import { getAnnotationData } from "~/components/experiment-data/annotations/utils";
import { getAllRowsSelectionCheckbox } from "~/components/experiment-data/annotations/utils";
import { getRowSelectionCheckbox } from "~/components/experiment-data/annotations/utils";
import { getAnnotationsColumn } from "~/components/experiment-data/annotations/utils";
import type { BulkSelectionFormType } from "~/components/experiment-data/experiment-data-table";
import { tsr } from "~/lib/tsr";

import type { Annotation, AnnotationType, DataColumn, ExperimentData } from "@repo/api";

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
  count: number;
  commentCount: number;
}

// Time in ms before data is removed from the cache
const STALE_TIME = 2 * 60 * 1000;

// ID column name
const ID_COLUMN_NAME = "id";

export function identifyAnnotationColumns(data: ExperimentData) {
  if (data.columns.length === 0) return;
  const idColumnIndex = data.columns.findIndex((col) => col.name === ID_COLUMN_NAME);
  if (idColumnIndex === -1) return; // ID must be present for annotations to work
  if (idColumnIndex !== -1 && data.columns[idColumnIndex].type_name !== "LONG") return; // ID must be of type LONG
  data.columns[idColumnIndex].type_name = "ID";
  data.columns[idColumnIndex].type_text = "ID";
  const annotationColumnIndex = data.columns.findIndex((col) => col.name === "annotations");
  if (annotationColumnIndex === -1) return;
  if (data.columns[annotationColumnIndex].type_name !== "ARRAY") return;
  if (
    data.columns[annotationColumnIndex].type_text !==
    "ARRAY<STRUCT<id: STRING, rowId: INT, type: STRING, content: STRUCT<text: STRING, flagType: STRING>, createdBy: STRING, createdAt: TIMESTAMP, updatedAt: TIMESTAMP>>"
  )
    return;
  data.columns[annotationColumnIndex].type_name = "ANNOTATIONS";
  data.columns[annotationColumnIndex].type_text = "ANNOTATIONS";
}

export function getColumnWidth(typeName: string): number | undefined {
  // Set very small width for id column to accommodate checkboxes
  if (typeName === "ID") return 30;
  // Set medium width for user columns that contain avatar + name
  if (typeName === "USER") return 180;
  // Set medium width for array of struct columns that contain collapsible content
  if (typeName.startsWith("ARRAY<STRUCT<")) return 200;
  // Set smaller width for array columns that contain charts
  if (typeName === "ARRAY" || typeName.startsWith("ARRAY<")) return 120;
  // Set medium width for map columns that contain collapsible content
  if (typeName === "MAP" || typeName.startsWith("MAP<")) return 200;
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
  selectionForm?: UseFormReturn<BulkSelectionFormType>;
}

function createTableColumns({
  experimentId,
  tableName,
  data,
  formatFunction,
  onChartHover,
  onChartLeave,
  onChartClick,
  selectionForm,
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
      case "USER":
        return 5;
      case "STRING":
        return 6;
      case "DOUBLE":
      case "INT":
      case "LONG":
      case "BIGINT":
        return 7;
      default:
        if (
          typeName === "MAP" ||
          typeName.startsWith("MAP<") ||
          typeName.startsWith("ARRAY<STRUCT<")
        )
          return 4;
        if (typeName === "ARRAY" || typeName.startsWith("ARRAY<")) return 8;
        return 9; // Other types at the end
    }
  };

  // Sort columns by type precedence
  const sortedColumns = [...data.columns].sort((a, b) => {
    const precedenceA = getTypePrecedence(a.type_text);
    const precedenceB = getTypePrecedence(b.type_text);
    return precedenceA - precedenceB;
  });

  function getHeader(typeName: string, columnName: string) {
    if (typeName === "ID" && selectionForm) return () => getAllRowsSelectionCheckbox(selectionForm);
    return columnName;
  }

  function getRow(typeName: string, columnName: string, row: Row<DataRow>) {
    // ID column shows a checkbox
    if (typeName === "ID" && selectionForm) {
      return getRowSelectionCheckbox(selectionForm, row.original[ID_COLUMN_NAME] as string);
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
        try {
          const jsonData: unknown = JSON.parse(value as string);
          const annotationData = getAnnotationData(jsonData as Annotation[]);
          return getAnnotationsColumn(commentRowId, annotationData);
        } catch {
          return null;
        }
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
        header: getHeader(dataColumn.type_text, dataColumn.name),
        size: getColumnWidth(dataColumn.type_text),
        meta: {
          type: dataColumn.type_text,
        },
        cell: ({ row }) => {
          return getRow(dataColumn.type_text, dataColumn.name, row);
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
 * @param orderBy Optional column name to order results by
 * @param orderDirection Optional sort direction for ordering (ASC or DESC)
 * @param formatFunction Function used to render the column value
 * @param onChartHover Event handler for when a chart is hovered
 * @param onChartLeave Event handler for when a chart is no longer hovered
 * @param onChartClick Event handler for when a chart is clicked
 * @param selectionForm Backing form to manage bulk selection state
 * @returns Query result containing the experiment data
 */
export const useExperimentData = (
  experimentId: string,
  page: number,
  pageSize: number,
  tableName: string,
  orderBy?: string,
  orderDirection?: "ASC" | "DESC",
  formatFunction?: DataRenderFunction,
  onChartHover?: (data: number[], columnName: string) => void,
  onChartLeave?: () => void,
  onChartClick?: (data: number[], columnName: string) => void,
  selectionForm?: UseFormReturn<BulkSelectionFormType>,
) => {
  const { data, isLoading, error } = tsr.experiments.getExperimentData.useQuery({
    queryData: {
      params: { id: experimentId },
      query: { tableName, page, pageSize, orderBy, orderDirection },
    },
    queryKey: ["experiment", experimentId, page, pageSize, tableName, orderBy, orderDirection],
    staleTime: STALE_TIME,
  });

  // Identify annotation columns
  const originalTableData = data?.body[0];
  const tableData = useMemo(() => {
    if (originalTableData?.data) {
      identifyAnnotationColumns(originalTableData.data);
    }
    return originalTableData;
  }, [originalTableData]);

  // Add all row id's to form
  const allRowIds = useMemo(() => {
    if (tableData?.data) {
      if (tableData.data.columns.find((col) => col.name === ID_COLUMN_NAME)) {
        // Extract all row IDs from the data
        return tableData.data.rows.map((row) => row[ID_COLUMN_NAME] as string);
      }
      return [];
    }
  }, [tableData]);
  useEffect(() => {
    if (selectionForm) {
      selectionForm.setValue("allRows", allRowIds ?? []);
    }
  }, [selectionForm, allRowIds]);

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
            selectionForm,
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
    selectionForm,
  ]);
  const tableRows: DataRow[] | undefined = tableData?.data?.rows;
  const displayName = tableData?.displayName;

  return { tableMetadata, tableRows, displayName, isLoading, error };
};

export interface SampleTable {
  name: string;
  displayName: string;
  tableMetadata: TableMetadata;
  tableRows: DataRow[];
  columns: DataColumn[]; // Add raw columns for easy access
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
        displayName: tableData.displayName,
        tableMetadata: {
          columns: createTableColumns({ experimentId, data: tableData.data, formatFunction }),
          totalPages: tableData.totalPages,
          totalRows: tableData.totalRows,
        } as TableMetadata,
        tableRows: tableData.data?.rows ?? [],
        columns: tableData.data?.columns ?? [], // Add raw columns
      });
    });
    return tables;
  }, [experimentId, data, formatFunction]);

  return { sampleTables, isLoading, error };
};
