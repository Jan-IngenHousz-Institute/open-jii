"use client";

import { useExperimentMockData } from "@/hooks/experiment/mock/useExperimentMockData";

import type { ExperimentData } from "@repo/api";
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
              return <TableHead key={column.name}>{column.name}</TableHead>;
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
  return data.rows.map((row, index) => {
    return (
      <TableRow key={index}>
        {row.map((column, index) => {
          return <TableCell key={index}>{column}</TableCell>;
        })}
      </TableRow>
    );
  });
}
