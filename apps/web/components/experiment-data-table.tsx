"use client";

import { useExperimentMockData } from "@/hooks/experiment/mock/useExperimentMockData";
import type { z } from "zod";

import type { ExperimentData, zDataColumn } from "@repo/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components";

export function ExperimentDataTable({ id }: { id: string }) {
  const { data, isLoading } = useExperimentMockData(id);

  if (isLoading) return <div>Is loading</div>;
  if (data)
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {data.columns.map((column) => {
              return (
                <TableHead key={column.name}>{column.type_text}</TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          <ExperimentDataContent data={data} />
        </TableBody>
      </Table>
    );
  return <div>No data returned</div>;
}

interface ExperimentDataContentProps {
  data: ExperimentData;
}

function ExperimentDataContent({ data }: ExperimentDataContentProps) {
  if (data.rows.length == 0)
    return (
      <TableRow>
        <TableCell colSpan={data.columns.length}>No rows found</TableCell>
      </TableRow>
    );
  return data.rows.map((row, index) => (
    <ExperimentDataRow key={index} columns={data.columns} row={row} />
  ));
}

interface ExperimentDataValueProps {
  type: string;
  value: string | null;
}

function ExperimentDataValue({ type, value }: ExperimentDataValueProps) {
  switch (type) {
    case "float":
      return <i>{value}</i>;
    default:
      return <>{value}</>;
  }
}

interface ExperimentDataRowProps {
  columns: z.infer<typeof zDataColumn>[];
  row: (string | null)[];
}

function ExperimentDataRow({ columns, row }: ExperimentDataRowProps) {
  return (
    <TableRow>
      {row.map((value, index) => {
        const dataColumn = columns[index];
        const dataAlign = dataColumn.type_name === "float" ? "right" : "left";
        return (
          <TableCell align={dataAlign} key={index}>
            <ExperimentDataValue type={dataColumn.type_name} value={value} />
          </TableCell>
        );
      })}
    </TableRow>
  );
}
