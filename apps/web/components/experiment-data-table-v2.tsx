"use client";

import { useExperimentMockData } from "@/hooks/experiment/mock/useExperimentMockData";
import type { AccessorKeyColumnDef, ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";

import type { ExperimentData } from "@repo/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components";

function getColumnMetaType(type_name: string) {
  switch (type_name) {
    case "float":
      return "number";
    default:
      return "text";
  }
}

function getReactTableColumns(data: ExperimentData) {
  const columnHelper = createColumnHelper();
  const columns: AccessorKeyColumnDef<unknown, never>[] = [];
  data.columns.forEach((column) => {
    columns.push(
      columnHelper.accessor(column.name, {
        header: column.type_text,
        meta: {
          type: getColumnMetaType(column.type_name),
        },
      }),
    );
  });
  return columns;
}

function getReactTableData(data: ExperimentData) {
  const newData: Record<string, string | number | boolean | null>[] = [];
  data.rows.forEach((row) => {
    const dataRow: Record<string, string | number | boolean | null> = {};
    row.forEach((dataColumn, index) => {
      dataRow[data.columns[index].name] = dataColumn;
    });
    newData.push(dataRow);
  });
  return newData;
}

export function ExperimentDataTableV2({ id }: { id: string }) {
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
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
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
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
