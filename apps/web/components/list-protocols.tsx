"use client";

import { ProtocolOverviewCards } from "~/components/protocol-overview-cards";
import { useProtocols } from "~/hooks/protocol/useProtocols/useProtocols";

import { Input } from "@repo/ui/components";

export function ListProtocols() {
  const { protocols, search, setSearch } = useProtocols({});

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

      <ProtocolOverviewCards protocols={protocols} />
    </div>
  );
}
