"use client";

import { useMacro } from "@/hooks/macro/useMacro/useMacro";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { contract, getContractError } from "@/lib/tsr";
import { decodeBase64 } from "@/util/base64";
import { formatDate } from "@/util/date";
import { useEffect, useRef } from "react";

import type { SensorFamily } from "@repo/api/schemas/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

import { CodeDiff } from "./code-diff";

export interface ResolvedEntity {
  id: string;
  kind: "protocol" | "macro";
  exists: boolean;
  family?: SensorFamily;
  /** The lookup failed for a non-404 reason (network/server); status is unknown, not "removed". */
  loadFailed?: boolean;
}

type EntityStatus = "added" | "changed" | "unchanged" | "removed";

const statusVariant: Record<EntityStatus, "default" | "secondary" | "destructive" | "outline"> = {
  added: "default",
  changed: "default",
  unchanged: "secondary",
  removed: "destructive",
};

function EntityDiffShell({
  name,
  kind,
  status,
  updatedAt,
  oldText,
  newText,
}: {
  name: string;
  kind: "protocol" | "macro";
  status: EntityStatus;
  updatedAt?: string;
  oldText: string;
  newText: string;
}) {
  const { t } = useTranslation("experiments");
  const showDiff = status === "added" || status === "changed";

  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground shrink-0 text-[11px] uppercase tracking-wide">
            {t(`flow.upgradeDiff.kind.${kind}`)}
          </span>
          <span className="truncate text-sm font-medium">{name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {updatedAt && status !== "removed" ? (
            <span className="text-muted-foreground text-[11px]">
              {t("flow.upgradeDiff.lastChanged", { when: formatDate(updatedAt) })}
            </span>
          ) : null}
          <Badge variant={statusVariant[status]} className="text-[10px]">
            {t(`flow.upgradeDiff.status.${status}`)}
          </Badge>
        </div>
      </div>
      {showDiff ? (
        <details className="mt-2">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
            {t("flow.upgradeDiff.viewDiff")}
          </summary>
          <div className="mt-2">
            <CodeDiff oldText={oldText} newText={newText} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

interface RowProps {
  id: string;
  /** Frozen code from the pinned version snapshot; absent when the cell was added since. */
  oldCode?: unknown;
  fallbackName?: string;
  onResolved: (r: ResolvedEntity) => void;
}

export function ProtocolDiffRow({ id, oldCode, fallbackName, onResolved }: RowProps) {
  const query = useProtocol(id);
  const body = query.data?.body;
  const settled = !query.isLoading;
  const exists = !!body;
  // A 404 means the protocol was genuinely deleted (removed); any other error
  // (5xx, network) is transient and must not be reported as "removed".
  const notFound = getContractError(contract.protocols.getProtocol, query.error)?.status === 404;
  const loadFailed = !!query.error && !notFound;

  const reported = useRef(false);
  useEffect(() => {
    if (settled && !reported.current) {
      reported.current = true;
      onResolved({ id, kind: "protocol", exists, family: body?.family, loadFailed });
    }
  }, [settled, exists, body?.family, loadFailed, id, onResolved]);

  if (!settled || loadFailed) return null;

  const oldText = oldCode != null ? JSON.stringify(oldCode, null, 2) : "";
  const newText = body?.code != null ? JSON.stringify(body.code, null, 2) : "";
  const status: EntityStatus = !exists
    ? "removed"
    : oldCode == null
      ? "added"
      : oldText !== newText
        ? "changed"
        : "unchanged";

  // Unchanged entities still report for the verdict but are not listed.
  if (status === "unchanged") return null;

  return (
    <EntityDiffShell
      name={body?.name ?? fallbackName ?? id}
      kind="protocol"
      status={status}
      updatedAt={body?.updatedAt}
      oldText={oldText}
      newText={newText}
    />
  );
}

export function MacroDiffRow({ id, oldCode, fallbackName, onResolved }: RowProps) {
  const { data: body, isLoading, error } = useMacro(id);
  const settled = !isLoading;
  const exists = !!body;
  // A 404 means the macro was genuinely deleted (removed); any other error
  // (5xx, network) is transient and must not be reported as "removed".
  const notFound = getContractError(contract.macros.getMacro, error)?.status === 404;
  const loadFailed = !!error && !notFound;

  const reported = useRef(false);
  useEffect(() => {
    if (settled && !reported.current) {
      reported.current = true;
      onResolved({ id, kind: "macro", exists, loadFailed });
    }
  }, [settled, exists, loadFailed, id, onResolved]);

  if (!settled || loadFailed) return null;

  const oldText = typeof oldCode === "string" ? decodeBase64(oldCode) : "";
  const newText = body?.code ? decodeBase64(body.code) : "";
  const status: EntityStatus = !exists
    ? "removed"
    : oldCode == null
      ? "added"
      : oldText !== newText
        ? "changed"
        : "unchanged";

  // Unchanged entities still report for the verdict but are not listed.
  if (status === "unchanged") return null;

  return (
    <EntityDiffShell
      name={body?.name ?? fallbackName ?? id}
      kind="macro"
      status={status}
      updatedAt={body?.updatedAt}
      oldText={oldText}
      newText={newText}
    />
  );
}
