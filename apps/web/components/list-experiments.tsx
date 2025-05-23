"use client";

import { EditIcon, LockIcon, GlobeIcon } from "lucide-react";
import Link from "next/link";

import { zExperimentVisibility } from "@repo/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components";

import { useExperiments } from "../hooks/experiment/useExperiments/useExperiments";
import { formatDate } from "../util/date";

interface ListExperimentProps {
  userId: string;
}

export function ListExperiments({ userId }: ListExperimentProps) {
  const { data, filter, setFilter } = useExperiments();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select
          defaultValue="my"
          value={filter}
          onValueChange={(value: "my" | "member" | "related" | "all") =>
            setFilter(value)
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter experiments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="my">My Experiments</SelectItem>
            <SelectItem value="member">Member Experiments</SelectItem>
            <SelectItem value="related">All Related Experiments</SelectItem>
            <SelectItem value="all">All Experiments</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Experiment name</TableHead>
              <TableHead>Owner/Member</TableHead>
              <TableHead className="text-center">Visibility</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.body.map((experiment) => {
              const isOwner = experiment.createdBy === userId;
              const isPrivate =
                experiment.visibility === zExperimentVisibility.enum.private;

              return (
                <TableRow key={experiment.id}>
                  <TableCell>{experiment.name}</TableCell>
                  <TableCell>{isOwner ? "Owner" : "Member"}</TableCell>
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
                        <TooltipContent>
                          {isPrivate ? "Private" : "Public"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>{formatDate(experiment.createdAt)}</TableCell>
                  <TableCell>N/A</TableCell>
                  <TableCell className="text-center">
                    {isOwner && (
                      <div className="inline-flex justify-center">
                        <Link href={`/openjii/experiments/${experiment.id}`}>
                          <EditIcon size={18} />
                        </Link>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="py-4 text-center">Loading experiments...</div>
      )}
    </div>
  );
}
