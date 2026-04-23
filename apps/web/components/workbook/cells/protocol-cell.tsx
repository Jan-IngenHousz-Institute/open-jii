"use client";

import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { Check, Copy, ExternalLink, Loader2, Microscope } from "lucide-react";
import Link from "next/link";

import type { ProtocolCell as ProtocolCellType } from "@repo/api";
import { Button } from "@repo/ui/components";

import { CellWrapper } from "../cell-wrapper";
import { WorkbookCodeEditor } from "../workbook-code-editor";

interface ProtocolCellProps {
  cell: ProtocolCellType;
  onUpdate: (cell: ProtocolCellType) => void;
  onDelete: () => void;
  onRun?: () => void;
  executionStatus?: "idle" | "running" | "completed" | "error";
  executionError?: string;
  readOnly?: boolean;
}

export function ProtocolCellComponent({
  cell,
  onUpdate,
  onDelete,
  onRun,
  executionStatus,
  executionError,
  readOnly,
}: ProtocolCellProps) {
  const protocolId = cell.payload.protocolId;
  const { copy, copied } = useCopyToClipboard();

  // Fetch protocol data
  const { data: protocolData, isLoading: protocolLoading } = useProtocol(protocolId, true);
  const protocolName = protocolData?.body.name;
  const protocolCode =
    protocolData?.body.code && protocolData.body.code.length > 0
      ? JSON.stringify(protocolData.body.code, null, 2)
      : null;

  const protocolFamily = protocolData?.body.family;

  const handleCopy = () => {
    void copy(protocolCode ?? "");
  };

  const displayName = cell.payload.name ?? protocolName ?? "Protocol";

  return (
    <CellWrapper
      icon={<Microscope className="h-3.5 w-3.5" />}
      label={displayName}
      accentColor="#2D3142"
      isCollapsed={cell.isCollapsed}
      onToggleCollapse={(collapsed) => onUpdate({ ...cell, isCollapsed: collapsed })}
      onDelete={onDelete}
      onRun={onRun}
      executionStatus={executionStatus}
      executionError={executionError}
      readOnly={readOnly}
      headerBadges={
        <div className="flex items-center gap-1.5">
          {protocolFamily && (
            <span
              className="rounded px-1.5 py-0.5 text-xs font-medium capitalize"
              style={{
                backgroundColor: "color-mix(in srgb, #2D3142 10%, transparent)",
                border: "1px solid color-mix(in srgb, #2D3142 25%, transparent)",
                color: "#2D3142",
              }}
            >
              {getSensorFamilyLabel(protocolFamily)}
            </span>
          )}
          <Link href={`/platform/protocols/${protocolId}`} target="_blank">
            <ExternalLink className="text-muted-foreground hover:text-foreground h-3 w-3 transition-colors" />
          </Link>
        </div>
      }
      headerActions={
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 w-7 p-0"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      }
    >
      {protocolLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        </div>
      ) : protocolCode ? (
        <WorkbookCodeEditor
          value={protocolCode}
          language="json"
          minHeight="80px"
          maxHeight="400px"
          readOnly
        />
      ) : (
        <p className="text-muted-foreground px-3 py-4 text-xs">Could not load protocol code</p>
      )}
    </CellWrapper>
  );
}
