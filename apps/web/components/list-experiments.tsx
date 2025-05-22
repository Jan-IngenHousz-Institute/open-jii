"use client";

import { EditIcon, LockIcon } from "lucide-react";
import Link from "next/link";

import { zExperimentVisibility } from "@repo/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components";

import { useExperiments } from "../hooks/experiment/useExperiments/useExperiments";

export function ListExperiments() {
  const { data } = useExperiments();

  if (data) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Experiment name</TableHead>
            <TableHead>Owner/Member</TableHead>
            <TableHead>Private</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.body.map((experiment) => {
            return (
              <TableRow key={experiment.id}>
                <TableCell>{experiment.name}</TableCell>
                <TableCell>TODO</TableCell>
                <TableCell>
                  {experiment.visibility ===
                    zExperimentVisibility.enum.private && (
                    <LockIcon size={18} />
                  )}
                </TableCell>
                <TableCell>{experiment.createdAt.substring(0, 10)}</TableCell>
                <TableCell>TODO</TableCell>
                <TableCell>
                  <Link href={`/openjii/experiments/${experiment.id}`}>
                    <EditIcon size={18} />
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }
}
