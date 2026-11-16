"use client";

import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { LayoutAttributeChangeDialog } from "./layout-attribute-change-dialog";
import { LayoutAttributeVersion } from "./layout-attribute-version";
import type { HistoryEntry, PlotAttributeHistory } from "./plot-attribute-history";

interface LayoutPlotAttributeProps {
  history: PlotAttributeHistory;
  plotName: string;
  /** Offers Edit, which asks whether a change is planned from a date or corrects a mistake. */
  canEdit: boolean;
}

/** One attribute in the plot panel: the value in force today, its source, and its history beneath. */
export function LayoutPlotAttribute({ history, plotName, canEdit }: LayoutPlotAttributeProps) {
  const { t } = useTranslation("experiments");
  const [isEditing, setIsEditing] = useState(false);

  const { current, others } = history;
  const hasHistory = others.length > 0;

  const openEdit = () => {
    setIsEditing(true);
  };

  const closeEdit = () => {
    setIsEditing(false);
  };

  const renderEntry = (entry: HistoryEntry, index: number) => (
    <li key={index}>
      <LayoutAttributeVersion entry={entry} showsValue />
    </li>
  );

  return (
    <div className="space-y-2" data-plot-attribute={history.name}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <dt className="text-muted-foreground text-xs">{history.name}</dt>
          <dd className="text-sm font-medium">{current?.version.value}</dd>
          {current ? (
            <dd>
              <LayoutAttributeVersion entry={current} showsValue={false} />
            </dd>
          ) : null}
        </div>
        {canEdit ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 px-2"
            aria-label={t("layout.plot.editValue", { name: history.name })}
            onClick={openEdit}
          >
            {t("layout.plot.edit")}
          </Button>
        ) : null}
      </div>

      {hasHistory ? (
        <dd>
          <ol className="ml-1.5 space-y-2 border-l pl-3" data-attribute-history>
            {others.map(renderEntry)}
          </ol>
        </dd>
      ) : null}

      {isEditing ? (
        <LayoutAttributeChangeDialog
          plotName={plotName}
          attributeName={history.name}
          currentValue={current?.version.value ?? ""}
          onClose={closeEdit}
        />
      ) : null}
    </div>
  );
}
