"use client";

import type { CreateExperimentBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components";

interface ProtocolsSectionProps {
  formData: CreateExperimentBody;
  onEdit: () => void;
}

export function ProtocolsSection({ formData, onEdit }: ProtocolsSectionProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            {t("experiments.protocolsTitle")}
          </CardTitle>
          <button
            type="button"
            onClick={onEdit}
            className="text-muted-foreground text-xs transition-colors"
          >
            {t("common.edit")}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
          {t("experiments.selectedProtocols")} ({formData.protocols?.length ?? 0})
        </div>
        {formData.protocols?.length ? (
          <div className="space-y-2">
            {formData.protocols.map((p, i) => (
              <div
                key={p.protocolId || i}
                className="rounded-md border px-3 py-2 text-sm font-medium"
              >
                {p.name ?? t("experiments.unnamedProtocol")}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground text-sm italic">
            {t("experiments.noProtocolsAdded")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
