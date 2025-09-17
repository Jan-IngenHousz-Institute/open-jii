import type { AccessorKeyColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import type React from "react";
import { useMemo } from "react";
import type { CommentsRowIdentifier } from "~/components/experiment-data/comments/utils";
import {
  getCommentsColumn,
  getRowCheckbox,
  getToggleAllRowsCheckbox,
} from "~/components/experiment-data/comments/utils";
import { tsr } from "~/lib/tsr";

import type { ExperimentData } from "@repo/api";

export type DataValue = string | null;
export type DataRow = Record<string, DataValue>;
export type DataRenderFunction = (value: unknown, type: string) => string | React.JSX.Element;

// Time in ms before data is removed from the cache
const STALE_TIME = 2 * 60 * 1000;

interface CreateTableColumnsParams {
  experimentId: string;
  tableName?: string;
  data: ExperimentData | undefined;
  formatFunction: DataRenderFunction;
  commentsColumnName?: string;
}

function createTableColumns({
  experimentId,
  tableName,
  data,
  formatFunction,
  commentsColumnName,
}: CreateTableColumnsParams) {
  const columnHelper = createColumnHelper<DataRow>();

  const columns: AccessorKeyColumnDef<DataRow, DataValue>[] = [];
  if (!data) return columns;

  let idColumnName: string | undefined;

  data.columns.forEach((dataColumn) => {
    switch (dataColumn.type_name) {
      case "ID":
        if (tableName === undefined) return;
        columns.push(
          columnHelper.accessor(dataColumn.name, {
            id: dataColumn.name,
            header: () => getToggleAllRowsCheckbox(),
            meta: {
              type: dataColumn.type_name,
            },
            cell: ({ row }) => {
              return getRowCheckbox(row);
            },
            size: 30,
          }),
        );
        idColumnName = dataColumn.name;
        break;
      case "JSON_COMMENTS":
        if (tableName === undefined) return;
        columns.push(
          columnHelper.accessor(dataColumn.name, {
            header: commentsColumnName ?? "Comments & Flags--",
            meta: {
              type: dataColumn.type_name,
            },
            cell: ({ row }) => {
              const value = row.getValue(dataColumn.name);
              const rowId = idColumnName ? row.getValue(idColumnName) : undefined;
              if (rowId) {
                const commentRowId: CommentsRowIdentifier = {
                  experimentId,
                  tableName,
                  rowId: rowId as string,
                };
                return getCommentsColumn(commentRowId, value as string);
              }
              return value as string;
            },
          }),
        );
        break;
      default:
        columns.push(
          columnHelper.accessor(dataColumn.name, {
            header: dataColumn.name,
            meta: {
              type: dataColumn.type_name,
            },
            cell: ({ row }) => {
              const value = row.getValue(dataColumn.name);
              return formatFunction(value, dataColumn.type_name);
            },
          }),
        );
    }
  });
  return columns;
}

export interface TableMetadata {
  columns: AccessorKeyColumnDef<DataRow, DataValue>[];
  totalRows: number;
  totalPages: number;
}

export interface UseExperimentDataProps {
  experimentId: string; // The ID of the experiment to fetch
  tableName: string; // Name of the table to fetch
  page: number; // Page to fetch; pages start with 1
  pageSize: number; // Page to fetch; pages start with 1
  formatFunction: DataRenderFunction; // Function used to render the column value
  commentsColumnName?: string; // Name for the comments column
}

/**
 * Hook to fetch experiment data by ID using regular pagination
 */
export const useExperimentData = ({
  experimentId,
  page,
  pageSize,
  tableName,
  formatFunction,
  commentsColumnName,
}: UseExperimentDataProps) => {
  const { data, isLoading, error } = tsr.experiments.getExperimentData.useQuery({
    queryData: {
      params: { id: experimentId },
      query: { tableName, page, pageSize },
    },
    queryKey: ["experiment", experimentId, page, pageSize, tableName],
    staleTime: STALE_TIME,
  });

  const tableData = data?.body[0];
  const tableMetadata: TableMetadata | undefined = useMemo(() => {
    return tableData
      ? {
          columns: createTableColumns({
            experimentId,
            tableName,
            data: tableData.data,
            formatFunction,
            commentsColumnName,
          }),
          totalPages: tableData.totalPages,
          totalRows: tableData.totalRows,
        }
      : undefined;
  }, [tableData, experimentId, tableName, formatFunction, commentsColumnName]);
  const tableRows: DataRow[] | undefined = tableData?.data?.rows;

  return { tableMetadata, tableRows, isLoading, error };
};

export interface SampleTable {
  name: string;
  tableMetadata: TableMetadata;
  tableRows: DataRow[];
}

export interface UseExperimentSampleDataProps {
  experimentId: string; // The ID of the experiment to fetch
  sampleSize?: number; // Number of sample rows to fetch
  formatFunction: DataRenderFunction; // Function used to render the column value
}

/**
 * Hook to fetch experiment sample data by ID
 */
export const useExperimentSampleData = ({
  experimentId,
  sampleSize = 5,
  formatFunction,
}: UseExperimentSampleDataProps) => {
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
  }, [data, experimentId, formatFunction]);

  return { sampleTables, isLoading, error };
};
