"use client";

import { useMemo, useState } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";
import { useMetadata } from "./metadata-context";
import { EditableCell } from "./editable-cell";
import type { MetadataRow } from "./types";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components";
import { cn } from "@repo/ui/lib/utils";
import { MoreHorizontal, Trash2 } from "lucide-react";

interface MetadataTableProps {
  pageSize?: number;
  disabled?: boolean;
}

export function MetadataTable({ pageSize = 10, disabled = false }: MetadataTableProps) {
  const { state, updateCell, deleteRow, deleteColumn, renameColumn } = useMetadata();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const columns = useMemo<ColumnDef<MetadataRow>[]>(() => {
    const cols: ColumnDef<MetadataRow>[] = state.columns.map((col) => ({
      id: col.id,
      accessorKey: col.id,
      header: () => (
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{col.name}</span>
          {!disabled && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    const newName = prompt("Enter new column name:", col.name);
                    if (newName && newName !== col.name) {
                      renameColumn(col.id, newName);
                    }
                  }}
                >
                  Rename column
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => deleteColumn(col.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete column
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ),
      cell: ({ row }) => (
        <EditableCell
          value={row.getValue(col.id)}
          rowId={row.original._id}
          columnId={col.id}
          type={col.type}
          onUpdate={updateCell}
          disabled={disabled}
        />
      ),
    }));

    // Add actions column (sticky, no rename/delete options)
    if (!disabled) {
      cols.push({
        id: "actions",
        header: "",
        size: 50,
        meta: { isActionsColumn: true },
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => deleteRow(row.original._id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ),
      });
    }

    return cols;
  }, [state.columns, updateCell, deleteRow, deleteColumn, renameColumn, disabled]);

  const table = useReactTable({
    data: state.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    state: { pagination },
  });

  const totalPages = table.getPageCount();

  if (state.columns.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="text-muted-foreground text-sm">
          No metadata yet. Import data or add columns to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-hidden">
      <div className="relative overflow-auto rounded-lg border">
        <Table className="w-max min-w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isActionsColumn = header.column.id === "actions";
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: header.column.columnDef.size }}
                      className={cn(
                        isActionsColumn &&
                          "sticky right-0 bg-background shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No rows. Add a row to get started.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const isActionsColumn = cell.column.id === "actions";
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "p-0",
                          isActionsColumn &&
                            "sticky right-0 bg-background shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {state.rows.length} row{state.rows.length !== 1 ? "s" : ""}
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  className={cn(
                    "border",
                    !table.getCanPreviousPage() &&
                      "pointer-events-none cursor-not-allowed opacity-50"
                  )}
                  onClick={() => table.previousPage()}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-4 text-sm">
                  Page {pagination.pageIndex + 1} of {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  className={cn(
                    "border",
                    !table.getCanNextPage() &&
                      "pointer-events-none cursor-not-allowed opacity-50"
                  )}
                  onClick={() => table.nextPage()}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
