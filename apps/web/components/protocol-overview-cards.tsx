import { ResourceCard, ResourceCardGrid } from "@/components/shared/resource-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useProtocolCompatibleMacros } from "@/hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros";
import { useLocale } from "@/hooks/useLocale";
import { getSensorFamilyBadgeTone } from "@/util/sensor-family";
import React, { useMemo, useState } from "react";

import type {
  ProtocolList,
  ProtocolListItem,
  ProtocolMacroEntry,
} from "@repo/api/domains/protocol/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";

import { VisibilityBadge } from "./visibility/visibility-badge";

function CompatibleMacrosList({ protocolId, enabled }: { protocolId: string; enabled: boolean }) {
  const { data } = useProtocolCompatibleMacros(protocolId, enabled);
  const macros: ProtocolMacroEntry[] = useMemo(() => data ?? [], [data]);

  if (macros.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {macros.map((entry) => (
        <span
          key={entry.macro.id}
          className="bg-muted text-muted-foreground inline-block truncate rounded px-1.5 py-0.5 text-[11px]"
        >
          {entry.macro.name}
        </span>
      ))}
    </div>
  );
}

function ProtocolCard({
  protocol,
  locale,
  t,
}: {
  protocol: ProtocolListItem;
  locale: string;
  t: (key: string) => string;
}) {
  const [hovered, setHovered] = useState(false);
  const isPreferred = protocol.sortOrder !== null;

  return (
    <ResourceCard
      href={`/${locale}/platform/protocols/${protocol.id}`}
      title={protocol.name}
      featured={isPreferred}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      badges={
        <>
          <StatusBadge tone={getSensorFamilyBadgeTone(protocol.family)} className="capitalize">
            {protocol.family}
          </StatusBadge>
          {isPreferred && <Badge variant="secondary">{t("common.preferred")}</Badge>}
          {/* Only when private: "public" is the unremarkable default. */}
          <VisibilityBadge visibility={protocol.visibility} privateOnly />
        </>
      }
      extra={<CompatibleMacrosList protocolId={protocol.id} enabled={hovered} />}
      footer={`${t("protocols.lastUpdate")}: ${new Date(protocol.updatedAt).toLocaleDateString()}`}
    >
      <RichTextRenderer content={protocol.description ?? " "} truncate maxLines={2} />
    </ResourceCard>
  );
}

export function ProtocolOverviewCards({ protocols }: { protocols: ProtocolList | undefined }) {
  const { t } = useTranslation("common");
  const locale = useLocale();

  return (
    <ResourceCardGrid
      isLoading={!protocols}
      isEmpty={protocols?.length === 0}
      emptyMessage={t("protocols.noProtocols")}
    >
      {protocols?.map((protocol) => (
        <ProtocolCard key={protocol.id} protocol={protocol} locale={locale} t={t} />
      ))}
    </ResourceCardGrid>
  );
}
