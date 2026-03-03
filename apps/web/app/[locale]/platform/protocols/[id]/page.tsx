"use client";

import { ErrorDisplay } from "@/components/error-display";
import { JsonCodeViewer } from "@/components/json-code-viewer";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useProtocolCompatibleMacros } from "@/hooks/protocol/useProtocolCompatibleMacros/useProtocolCompatibleMacros";
import { formatDate } from "@/util/date";
import { CalendarIcon, CodeIcon, ExternalLink } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardContent, RichTextRenderer } from "@repo/ui/components";

interface ProtocolOverviewPageProps {
  params: Promise<{ id: string }>;
}

export default function ProtocolOverviewPage({ params }: ProtocolOverviewPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useProtocol(id);
  const { data: compatibleMacrosData } = useProtocolCompatibleMacros(id);
  const compatibleMacros = compatibleMacrosData?.body ?? [];
  const { t } = useTranslation();

  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("errors.failedToLoadProtocol")} />;
  }

  if (!data) {
    return <div>{t("protocols.notFound")}</div>;
  }

  const protocol = data.body;

  return (
    <div className="space-y-8">
      {/* Protocol info card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="text-2xl">{protocol.name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">{t("common.created")}</h4>
              <p className="flex items-center gap-1">
                <CalendarIcon className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                {formatDate(protocol.createdAt)}
              </p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">{t("common.updated")}</h4>
              <p className="flex items-center gap-1">
                <CalendarIcon className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                {formatDate(protocol.updatedAt)}
              </p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">{t("protocols.family")}</h4>
              <p className="capitalize">
                {protocol.family === "multispeq" ? "MultispeQ" : "Ambit"}
              </p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">
                {t("experiments.createdBy")}
              </h4>
              <p className="truncate">{protocol.createdByName ?? "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardHeader>{t("protocols.descriptionTitle")}</CardHeader>
        <CardContent>
          <RichTextRenderer content={protocol.description ?? ""} />
        </CardContent>
      </Card>

      {/* Compatible Macros (read-only) */}
      {compatibleMacros.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("protocolSettings.compatibleMacros")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {compatibleMacros.map((entry) => (
                <div key={entry.macro.id} className="flex items-center gap-2">
                  <Link
                    href={`/platform/macros/${entry.macro.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {entry.macro.name}
                  </Link>
                  <Link
                    href={`/platform/macros/${entry.macro.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="text-muted-foreground h-3.5 w-3.5" />
                  </Link>
                  <span className="text-muted-foreground text-xs">{entry.macro.language}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Code */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CodeIcon className="h-5 w-5" />
            <span>{t("protocols.codeTitle")}</span>
          </div>
        </CardHeader>
        <CardContent>
          <JsonCodeViewer value={protocol.code} height="700px" />
        </CardContent>
      </Card>
    </div>
  );
}
