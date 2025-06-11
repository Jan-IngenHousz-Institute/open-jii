"use client";

import { useExperimentMockData } from "@/hooks/experiment/mock/useExperimentMockData";
import type {
  AccessorKeyColumnDef,
  ColumnDef,
  Row,
  SortingState,
} from "@tanstack/react-table";
import { getSortedRowModel } from "@tanstack/react-table";
import { getPaginationRowModel } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import React from "react";

import type { ExperimentData } from "@repo/api";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components";

type DataRow = Record<string, string | number | boolean | null>;

type MetaType = "number" | "text";

function getColumnMetaType(type_name: string) {
  switch (type_name) {
    case "float":
      return "number";
    default:
      return "text";
  }
}

function getFormattedValue(
  row: Row<unknown>,
  columnName: string,
  metaType: MetaType,
) {
  const value = row.getValue(columnName);
  switch (metaType) {
    case "number": {
      return (
        <div className="text-right font-medium">
          <i>{value as number}</i>
        </div>
      );
    }
    default: {
      return <div className="font-medium">{value as string}</div>;
    }
  }
}

function getReactTableColumns(data: ExperimentData) {
  const columnHelper = createColumnHelper();
  const columns: AccessorKeyColumnDef<unknown, never>[] = [];
  data.columns.forEach((dataColumn) => {
    const metaType = getColumnMetaType(dataColumn.type_name);
    columns.push(
      columnHelper.accessor(dataColumn.name, {
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              {dataColumn.type_text}
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        meta: {
          type: metaType,
        },
        cell: ({ row }) => {
          return getFormattedValue(row, dataColumn.name, metaType);
        },
      }),
    );
  });
  return columns;
}

function getReactTableData(data: ExperimentData) {
  const newData: DataRow[] = [];
  data.rows.forEach((row) => {
    const dataRow: DataRow = {};
    row.forEach((dataColumn, index) => {
      dataRow[data.columns[index].name] = dataColumn;
    });
    newData.push(dataRow);
  });
  return newData;
}

export function ExperimentDataTable({ id }: { id: string }) {
  const { data, isLoading } = useExperimentMockData(id);

  if (isLoading) return <div>Is loading</div>;
  if (data) {
    const columns = getReactTableColumns(data);
    const newData = getReactTableData(data);
    return (
      <div className="container mx-auto py-10">
        <DataTable columns={columns} data={newData} />
      </div>
    );
  }
  return <div>No data returned</div>;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
