"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { formatDate } from "@/util/date";
import { CalendarIcon, CodeIcon } from "lucide-react";
import { use } from "react";

import { useTranslation } from "@repo/i18n";
import { Card, CardHeader, CardTitle, CardContent, RichTextRenderer } from "@repo/ui/components";

interface ProtocolOverviewPageProps {
  params: Promise<{ id: string }>;
}

export default function ProtocolOverviewPage({ params }: ProtocolOverviewPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useProtocol(id);
  const { t } = useTranslation(undefined, "common");

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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              <h4 className="text-muted-foreground text-sm font-medium">
                {t("protocols.protocolId")}
              </h4>
              <p className="truncate font-mono text-xs">{protocol.id}</p>
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

      {/* Code */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CodeIcon className="h-5 w-5" />
            <span>{t("protocols.codeTitle")}</span>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted overflow-auto rounded-md p-4">
            <code>{JSON.stringify(protocol.code, null, 2)}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
