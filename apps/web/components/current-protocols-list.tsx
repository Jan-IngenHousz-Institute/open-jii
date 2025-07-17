import { useLocale } from "@/hooks/useLocale";
import { Trash2, ExternalLink } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";

interface ProtocolWithInfo {
  id: string;
  name: string | null;
  family: string | null;
  createdBy?: string | null;
}

interface ProtocolListProps {
  protocols: ProtocolWithInfo[];
  onRemoveProtocol: (protocolId: string) => void;
  isRemovingProtocol: boolean;
  removingProtocolId: string | null;
}

export function ProtocolList({
  protocols,
  onRemoveProtocol,
  isRemovingProtocol,
  removingProtocolId,
}: ProtocolListProps) {
  const { t } = useTranslation(undefined, "common");
  const locale = useLocale();
  if (protocols.length === 0) {
    return (
      <div className="border-muted flex flex-col items-center justify-center py-4">
        <p className="text-muted-foreground text-base font-medium">
          {t("experimentSettings.noProtocolsYet")}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">{t("experimentSettings.addProtocols")}</p>
      </div>
    );
  }

  return (
    <div className="max-h-[400px] space-y-2 overflow-y-auto pr-2">
      {protocols.map((protocol) => (
        <div
          key={protocol.id}
          className="flex items-center justify-between gap-3 rounded border px-3 py-2"
        >
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            {/* Protocol name */}
            <div className="mb-1 flex items-center">
              <h4 className="text-foreground flex-1 truncate text-sm font-medium">
                {protocol.name ?? t("experimentSettings.unknownProtocol")}
              </h4>
            </div>

            {/* Family */}
            {protocol.family && (
              <div className="text-muted-foreground truncate text-xs">
                <span className="opacity-75">{t("experiments.family")}</span>{" "}
                <span className="font-medium">{protocol.family}</span>
              </div>
            )}

            {/* Created by */}
            {protocol.createdBy && (
              <div className="text-muted-foreground truncate text-xs">
                <span className="opacity-75">{t("experiments.createdBy")}</span>{" "}
                <span className="font-medium">{protocol.createdBy}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-0">
            {/* Delete button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemoveProtocol(protocol.id)}
              disabled={isRemovingProtocol && removingProtocolId === protocol.id}
              title={t("experimentSettings.removeProtocol")}
              className="hover:bg-destructive/10 h-8 w-8 flex-shrink-0 p-0"
              aria-label={t("experimentSettings.removeProtocol")}
            >
              <Trash2 className="text-destructive h-4 w-4" />
            </Button>
            {/* External link button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={t("experimentSettings.seeProtocolDetails")}
              onClick={() => {
                // Open protocol details in a new tab with locale
                window.open(`/${locale}/platform/protocols/${protocol.id}`, "_blank");
              }}
              aria-label={t("experimentSettings.seeProtocolDetails")}
            >
              <ExternalLink className="h-6 w-6" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
