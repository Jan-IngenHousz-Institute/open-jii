"use client";

import { ErrorDisplay } from "@/components/error-display";
import MacroCodeViewer from "@/components/macro-code-viewer";
import { useMacro } from "@/hooks/macro/useMacro/useMacro";
import { decodeBase64 } from "@/util/base64";
import { formatDate } from "@/util/date";
import { CalendarIcon, CodeIcon, UserIcon } from "lucide-react";
import React, { use } from "react";

import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  RichTextRenderer,
} from "@repo/ui/components";

interface MacroOverviewPageProps {
  params: Promise<{ id: string }>;
}

const getLanguageDisplay = (language: string) => {
  switch (language) {
    case "python":
      return "Python";
    case "r":
      return "R";
    case "javascript":
      return "JavaScript";
    default:
      return language;
  }
};

const getLanguageColor = (language: string) => {
  switch (language) {
    case "python":
      return "bg-badge-published";
    case "r":
      return "bg-badge-stale";
    case "javascript":
      return "bg-badge-provisioningFailed";
    default:
      return "bg-badge-archived";
  }
};

export default function MacroOverviewPage({ params }: MacroOverviewPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useMacro(id);
  const { t } = useTranslation(["macro", "common"]);

  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("errors.failedToLoadMacro")} />;
  }

  if (!data) {
    return <div>{t("macros.notFound")}</div>;
  }

  const macro = data;

  return (
    <div className="space-y-8">
      {/* Macro info card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="text-2xl">{macro.name}</CardTitle>
            <Badge className={getLanguageColor(macro.language)}>
              {getLanguageDisplay(macro.language)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">{t("common.created")}</h4>
              <p className="flex items-center gap-1">
                <CalendarIcon className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                {formatDate(macro.createdAt)}
              </p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">{t("common.updated")}</h4>
              <p className="flex items-center gap-1">
                <CalendarIcon className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                {formatDate(macro.updatedAt)}
              </p>
            </div>
            <div>
              <h4 className="text-muted-foreground text-sm font-medium">{t("common.createdBy")}</h4>
              <p className="flex items-center gap-1">
                <UserIcon className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                {macro.createdByName ?? "-"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      {macro.description && (
        <Card>
          <CardHeader>
            <CardTitle>{t("common.description")}</CardTitle>
          </CardHeader>
          <CardContent>
            <RichTextRenderer content={macro.description} />
          </CardContent>
        </Card>
      )}

      {/* Code Section Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CodeIcon className="h-5 w-5" />
            {t("macros.code")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {macro.code ? (
            <MacroCodeViewer
              value={decodeBase64(macro.code)}
              language={macro.language}
              height="500px"
            />
          ) : (
            <div className="py-8 text-center text-gray-500">
              <CodeIcon className="mx-auto mb-4 h-12 w-12" />
              <p>{t("macros.codeNotAvailable")}</p>
              <p className="text-sm">{t("macros.codeWillBeDisplayedWhenApiImplemented")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
