"use client";

import { CodeIcon, EditIcon } from "lucide-react";
import Link from "next/link";

import type { Protocol } from "@repo/api";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
  Input,
  Skeleton,
} from "@repo/ui/components";

import { useProtocols } from "../hooks/protocol/useProtocols/useProtocols";
import { formatDate } from "../util/date";

interface ListProtocolsProps {
  userId: string;
}

export function ListProtocols({ userId }: ListProtocolsProps) {
  const { protocols, isLoading, search, setSearch } = useProtocols({});

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Input
          placeholder="Search protocols..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[300px]"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Protocol name</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <LoadingRows />
          ) : protocols?.length === 0 ? (
            <EmptyProtocolsRow />
          ) : (
            protocols?.map((protocol) => (
              <ProtocolRow key={protocol.id} protocol={protocol} userId={userId} />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function ProtocolRow({ protocol, userId }: { protocol: Protocol; userId: string }) {
  const isOwner = protocol.createdBy === userId;

  return (
    <TableRow key={protocol.id}>
      <TableCell className="flex items-center gap-2">
        <CodeIcon size={16} className="text-muted-foreground" />
        {protocol.name}
      </TableCell>
      <TableCell>{formatDate(protocol.createdAt)}</TableCell>
      <TableCell>{formatDate(protocol.updatedAt)}</TableCell>
      <TableCell className="text-center">
        {isOwner && (
          <div className="inline-flex justify-center">
            <Link href={`/platform/protocols/${protocol.id}`}>
              <EditIcon size={18} />
            </Link>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function EmptyProtocolsRow() {
  return (
    <TableRow>
      <TableCell colSpan={5} className="h-24 text-center">
        No protocols found
      </TableCell>
    </TableRow>
  );
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <TableRow key={`skeleton-${index}`}>
          <TableCell>
            <Skeleton className="h-4 w-3/4" />
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
