import { ResourceCard, ResourceCardGrid } from "@/components/shared/resource-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useMacroCompatibleProtocols } from "@/hooks/macro/useMacroCompatibleProtocols/useMacroCompatibleProtocols";
import { useLocale } from "@/hooks/useLocale";
import { getMacroLanguageBadgeTone, getMacroLanguageLabel } from "@/util/macro-language";
import React, { useMemo, useState } from "react";

import type { Macro, MacroProtocolEntry } from "@repo/api/domains/macro/macro.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";

import { VisibilityBadge } from "./visibility/visibility-badge";

interface MacroOverviewCardsProps {
  macros: Macro[] | undefined;
  isLoading: boolean;
}

function CompatibleProtocolsList({ macroId, enabled }: { macroId: string; enabled: boolean }) {
  const { data } = useMacroCompatibleProtocols(macroId, enabled);
  const protocols: MacroProtocolEntry[] = useMemo(() => data ?? [], [data]);

  if (protocols.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {protocols.map((entry) => (
        <span
          key={entry.protocol.id}
          className="bg-muted text-muted-foreground inline-block truncate rounded px-1.5 py-0.5 text-[11px]"
        >
          {entry.protocol.name}
        </span>
      ))}
    </div>
  );
}

function MacroCard({
  macro,
  locale,
  t,
}: {
  macro: Macro;
  locale: string;
  t: (key: string) => string;
}) {
  const [hovered, setHovered] = useState(false);
  const isPreferred = macro.sortOrder !== null;

  return (
    <ResourceCard
      href={`/${locale}/platform/macros/${macro.id}`}
      title={macro.name}
      featured={isPreferred}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      badges={
        <>
          <StatusBadge tone={getMacroLanguageBadgeTone(macro.language)}>
            {getMacroLanguageLabel(macro.language)}
          </StatusBadge>
          {isPreferred && <Badge variant="secondary">{t("common.preferred")}</Badge>}
          {/* Only when private: "public" is the unremarkable default. */}
          <VisibilityBadge visibility={macro.visibility} privateOnly />
        </>
      }
      extra={<CompatibleProtocolsList macroId={macro.id} enabled={hovered} />}
      footer={`${t("macros.lastUpdate")}: ${new Date(macro.updatedAt).toLocaleDateString()}`}
    >
      <RichTextRenderer content={macro.description ?? " "} truncate maxLines={2} />
    </ResourceCard>
  );
}

export function MacroOverviewCards({ macros, isLoading }: MacroOverviewCardsProps) {
  const { t } = useTranslation(["macro", "common"]);
  const locale = useLocale();

  return (
    <ResourceCardGrid
      isLoading={isLoading}
      isEmpty={!macros || macros.length === 0}
      emptyMessage={t("macros.noMacros")}
    >
      {macros?.map((macro) => <MacroCard key={macro.id} macro={macro} locale={locale} t={t} />)}
    </ResourceCardGrid>
  );
}
