"use client";

import { formatDate } from "@/util/date";

import type { Protocol } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  RichTextRenderer,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@repo/ui/components";

import { useProtocol } from "../../../hooks/protocol/useProtocol/useProtocol";

export function ProtocolCard({
  protocol,
  isLoading,
  error,
}: {
  protocol?: Protocol;
  isLoading: boolean;
  error: unknown;
}) {
  const { t } = useTranslation("experiments");

  const MIN_FADE_LENGTH = 400;
  const isDescriptionLong = protocol?.description && protocol.description.length >= MIN_FADE_LENGTH;
  if (isLoading) {
    return <div className="h-[140px] animate-pulse rounded bg-gray-200" />;
  }

  if (error || !protocol) {
    return <p className="text-muted-foreground">{t("protocols.unableToLoadProtocol")}</p>;
  }

  return (
    <div className="bg-surface-light space-y-4">
      {/* Metadata */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <p className="text-muted-dark font-semibold">{t("protocols.sensorFamily")}</p>
          <p className="text-muted-foreground capitalize">{protocol.family}</p>
        </div>

        <div>
          <p className="text-muted-dark font-semibold">{t("updated")}</p>
          <p className="text-muted-foreground">{formatDate(protocol.updatedAt)}</p>
        </div>

        {protocol.createdByName && (
          <div>
            <p className="text-muted-dark font-semibold">{t("createdBy")}</p>
            <p className="text-muted-foreground">{protocol.createdByName}</p>
          </div>
        )}
      </div>

      {/* Description */}
      {protocol.description && protocol.description !== "<p><br></p>" && (
        <div className="space-y-0">
          <p className="text-muted-dark font-semibold">{t("form.description")}</p>

          <div className="relative">
            <div className="max-h-32 overflow-hidden">
              <RichTextRenderer content={protocol.description} />
            </div>

            {/* Fade gradient ONLY if description is long */}
            {isDescriptionLong && (
              <div className="from-surface-light pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t to-transparent" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProtocolSelector({
  protocolIds,
  selectedProtocolId,
  selectedProtocolName,
  onProtocolChange,
}: {
  protocolIds: string[];
  selectedProtocolId: string;
  selectedProtocolName?: string;
  onProtocolChange: (id: string) => void;
}) {
  const { t } = useTranslation("experiments");
  return (
    <Select value={selectedProtocolId} onValueChange={onProtocolChange}>
      <SelectTrigger className="h-auto w-fit border-none p-0 text-xl font-semibold shadow-none hover:bg-transparent focus:ring-0">
        <span className="font-medium">{selectedProtocolName ?? t("loading")}</span>
      </SelectTrigger>

      <SelectContent className="bg-surface">
        {protocolIds.map((id) => (
          <SelectItem key={id} value={id}>
            <ProtocolNamesDropdown protocolId={id} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ProtocolNamesDropdown({ protocolId }: { protocolId: string }) {
  const { data: protocolData, isLoading } = useProtocol(protocolId);
  const { t } = useTranslation("experiments");
  if (isLoading) {
    return <span className="text-muted-foreground text-xl font-semibold">{t("loading")}</span>;
  }

  return (
    <span className="font-medium">{protocolData?.body.name ?? t("protocols.unknownProtocol")}</span>
  );
}
