import type { AccessorKeyColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import type React from "react";
import { useMemo } from "react";
import { tsr } from "~/lib/tsr";

import type { ExperimentData } from "@repo/api";

export type DataValue = string | null;
export type DataRow = Record<string, DataValue>;
export type DataRenderFunction = (value: unknown, type: string) => string | React.JSX.Element;

// Time in ms before data is removed from the cache
const STALE_TIME = 2 * 60 * 1000;

function createTableColumns(data: ExperimentData | undefined, formatFunction?: DataRenderFunction) {
  const columnHelper = createColumnHelper<DataRow>();

  const columns: AccessorKeyColumnDef<DataRow, DataValue>[] = [];
  if (!data) return columns;

  data.columns.forEach((dataColumn) => {
    columns.push(
      columnHelper.accessor(dataColumn.name, {
        header: dataColumn.name,
        cell: ({ row }) => {
          const value = row.getValue(dataColumn.name);
          if (formatFunction) {
            return formatFunction(value, dataColumn.type_name);
          }
          return value as string;
        },
      }),
    );
  });
  return columns;
}

export interface TableMetadata {
  columns: AccessorKeyColumnDef<DataRow, DataValue>[];
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
 * @returns Query result containing the experiment data
 */
export const useExperimentData = (
  experimentId: string,
  page: number,
  pageSize: number,
  tableName: string,
  formatFunction?: DataRenderFunction,
) => {
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
          columns: createTableColumns(tableData.data, formatFunction),
          totalPages: tableData.totalPages,
          totalRows: tableData.totalRows,
        }
      : undefined;
  }, [tableData, formatFunction]);
  const tableRows: DataRow[] | undefined = tableData?.data?.rows;

  return { tableMetadata, tableRows, isLoading, error };
};

export interface SampleTable {
  tableName: string;
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
        tableName: tableData.name,
        tableMetadata: {
          columns: createTableColumns(tableData.data, formatFunction),
          totalPages: tableData.totalPages,
          totalRows: tableData.totalRows,
        } as TableMetadata,
        tableRows: tableData.data?.rows ?? [],
      });
    });
    return tables;
  }, [data, formatFunction]);

  return { sampleTables, isLoading, error };
};
