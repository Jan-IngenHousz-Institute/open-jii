"use client";

import { EditIcon, LockIcon, GlobeIcon } from "lucide-react";
import Link from "next/link";

import type { Experiment } from "@repo/api";
import { zExperimentVisibility } from "@repo/api";
import {
  TableCell,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Skeleton,
} from "@repo/ui/components";

import { formatDate } from "../util/date";

interface ExperimentRowProps {
  experiment: Experiment;
  userId: string;
}

export function ExperimentRow({ experiment, userId }: ExperimentRowProps) {
  const isOwner = experiment.createdBy === userId;
  const isPrivate =
    experiment.visibility === zExperimentVisibility.enum.private;

  return (
    <TableRow key={experiment.id}>
      <TableCell>{experiment.name}</TableCell>
      <TableCell className="text-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex justify-center">
                {isPrivate ? (
                  <LockIcon size={18} className="text-amber-500" />
                ) : (
                  <GlobeIcon size={18} className="text-blue-500" />
                )}
              </div>
            </TooltipTrigger>

            <TooltipContent>{isPrivate ? "Private" : "Public"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell>{experiment.status} </TableCell>
      <TableCell>{formatDate(experiment.createdAt)}</TableCell>
      <TableCell>{formatDate(experiment.updatedAt)}</TableCell>
      <TableCell className="text-center">
        {isOwner && (
          <div className="inline-flex justify-center">
            <Link href={`/platform/experiments/${experiment.id}`}>
              <EditIcon size={18} />
            </Link>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

export function EmptyExperimentsRow() {
  return (
    <TableRow>
      <TableCell colSpan={6} className="h-24 text-center">
        No experiments found
      </TableCell>
    </TableRow>
  );
}

export function LoadingRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <TableRow key={`skeleton-${index}`}>
          <TableCell>
            <Skeleton className="h-4 w-3/4" />
          </TableCell>
          <TableCell className="text-center">
            <div className="flex justify-center">
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-1/2" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell className="text-center">
            <div className="flex justify-center">
              <Skeleton className="h-4 w-4" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function ExperimentTableContent({
  data,
  userId,
}: {
  data: Experiment[] | undefined;
  userId: string;
}) {
  if (!data) {
    return <LoadingRows />;
  }

  if (data.length === 0) {
    return <EmptyExperimentsRow />;
  }

  return (
    <>
      {data.map((experiment: Experiment) => (
        <ExperimentRow
          key={experiment.id}
          experiment={experiment}
          userId={userId}
        />
      ))}
    </>
  );
}
