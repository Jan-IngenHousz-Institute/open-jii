"use client";

import { Table2 } from "lucide-react";

import type { ScopeTable } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Switch } from "@repo/ui/components/switch";

interface ScopeTableRowProps {
  table: ScopeTable;
  isIncluded: boolean;
  onToggle: (table: ScopeTable) => void;
}

/** One data table with its reading count and the switch that puts it in the dataset. */
export function ScopeTableRow({ table, isIncluded, onToggle }: ScopeTableRowProps) {
  const { t } = useTranslation("datasets");
  const isUntimed = table.days === null;

  const handleToggle = () => onToggle(table);

  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <Table2 className="text-primary size-4 shrink-0" aria-hidden />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{table.displayName}</p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {t("scope.tableReadings", { count: table.readingCount })}
        </p>
        {isUntimed ? <p className="text-muted-foreground text-xs">{t("scope.untimed")}</p> : null}
      </div>

      <Switch
        checked={isIncluded}
        onCheckedChange={handleToggle}
        aria-label={t("scope.include", { table: table.displayName })}
      />
    </li>
  );
}
