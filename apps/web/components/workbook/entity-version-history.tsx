"use client";

import { useMacroDuplicate } from "@/hooks/macro/useMacroDuplicate/useMacroDuplicate";
import { useMacroRestore } from "@/hooks/macro/useMacroRestore/useMacroRestore";
import { useMacroUsage } from "@/hooks/macro/useMacroUsage/useMacroUsage";
import { useMacroVersions } from "@/hooks/macro/useMacroVersions/useMacroVersions";
import { useProtocolDuplicate } from "@/hooks/protocol/useProtocolDuplicate/useProtocolDuplicate";
import { useProtocolRestore } from "@/hooks/protocol/useProtocolRestore/useProtocolRestore";
import { useProtocolUsage } from "@/hooks/protocol/useProtocolUsage/useProtocolUsage";
import { useProtocolVersions } from "@/hooks/protocol/useProtocolVersions/useProtocolVersions";
import { Copy, History, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/sheet";
import { toast } from "@repo/ui/hooks/use-toast";

interface EntityVersionHistoryProps {
  kind: "macro" | "protocol";
  entityId: string;
  currentVersion?: number;
  /** Called after a restore mints a new version (so a cell can reset its buffer). */
  onRestored?: () => void;
  /** Called after a duplicate creates a new entity (so a cell can swap to the fork). */
  onDuplicated?: (entity: { id: string; name: string }) => void;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EntityVersionHistory({
  kind,
  entityId,
  currentVersion,
  onRestored,
  onDuplicated,
}: EntityVersionHistoryProps) {
  const isMacro = kind === "macro";
  const [open, setOpen] = useState(false);

  // Hooks must be called unconditionally; enable only the relevant entity kind.
  const macroVersions = useMacroVersions(entityId, { enabled: isMacro && open });
  const protocolVersions = useProtocolVersions(entityId, { enabled: !isMacro && open });
  const macroUsage = useMacroUsage(entityId, { enabled: isMacro && open });
  const protocolUsage = useProtocolUsage(entityId, { enabled: !isMacro && open });
  const macroRestore = useMacroRestore(entityId);
  const protocolRestore = useProtocolRestore(entityId);
  const macroDuplicate = useMacroDuplicate();
  const protocolDuplicate = useProtocolDuplicate();

  const versions = (isMacro ? macroVersions.data?.body : protocolVersions.data?.body) ?? [];
  const usageCount = (isMacro ? macroUsage.data?.body : protocolUsage.data?.body)?.count;
  const isRestoring = macroRestore.isPending || protocolRestore.isPending;
  const isDuplicating = macroDuplicate.isPending || protocolDuplicate.isPending;
  const latestVersion = versions[0]?.version;

  const label = isMacro ? "macro" : "protocol";

  const handleRestore = (version: number) => {
    const onSuccess = () => {
      onRestored?.();
      toast({ description: `Restored ${label} from v${version}` });
      setOpen(false);
    };
    const onError = () => {
      toast({ description: `Couldn't restore the ${label} version`, variant: "destructive" });
    };
    if (isMacro) {
      macroRestore.mutate({ params: { id: entityId, version } }, { onSuccess, onError });
    } else {
      protocolRestore.mutate({ params: { id: entityId, version } }, { onSuccess, onError });
    }
  };

  const handleDuplicate = () => {
    const onSuccess = (data: { body: { id: string; name: string } }) => {
      onDuplicated?.({ id: data.body.id, name: data.body.name });
      toast({ description: `Created "${data.body.name}"` });
      setOpen(false);
    };
    const onError = () => {
      toast({ description: `Couldn't duplicate the ${label}`, variant: "destructive" });
    };
    if (isMacro) {
      macroDuplicate.mutate({ params: { id: entityId }, body: {} }, { onSuccess, onError });
    } else {
      protocolDuplicate.mutate({ params: { id: entityId }, body: {} }, { onSuccess, onError });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-7 w-7 p-0 hover:text-[#005E5E]"
          title="Version history"
          aria-label="Version history"
        >
          <History className="h-3.5 w-3.5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-96 flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Editing creates a new version. Other workbooks stay on their pinned version until you
            update them.
            {usageCount != null ? (
              <span className="mt-1 block font-medium">
                Used by {usageCount} workbook{usageCount === 1 ? "" : "s"}.
              </span>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 space-y-1 overflow-y-auto">
          {versions.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-xs">No versions yet</p>
          ) : (
            versions.map((v) => (
              <div
                key={v.version}
                className="hover:bg-accent flex items-center justify-between rounded-md px-2 py-1.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">v{v.version}</span>
                    {v.version === currentVersion ? (
                      <Badge variant="outline" className="text-[10px]">
                        current
                      </Badge>
                    ) : null}
                    {v.version === latestVersion ? (
                      <Badge variant="secondary" className="text-[10px]">
                        latest
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {v.createdByName ? `by ${v.createdByName} · ` : ""}
                    {formatDate(v.createdAt)}
                  </p>
                </div>
                {v.version !== latestVersion ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={isRestoring}
                    onClick={() => handleRestore(v.version)}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restore
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>

        <div className="mt-3 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            disabled={isDuplicating}
            onClick={handleDuplicate}
          >
            {isDuplicating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            Duplicate as a new {label}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
