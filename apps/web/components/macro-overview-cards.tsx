import { formatDate } from "@/util/date";
import { ArrowRight, Calendar, User } from "lucide-react";
import Link from "next/link";
import React from "react";

import type { Macro } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button, Card, CardContent, CardHeader } from "@repo/ui/components";

interface MacroOverviewCardsProps {
  macros: Macro[] | undefined;
  isLoading: boolean;
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
      return "bg-blue-100 text-blue-800";
    case "r":
      return "bg-green-100 text-green-800";
    case "javascript":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export function MacroOverviewCards({ macros, isLoading }: MacroOverviewCardsProps) {
  const { t } = useTranslation("common");

  if (isLoading) {
    return <div className="py-8 text-center">{t("common.loading")}</div>;
  }

  if (!macros || macros.length === 0) {
    return <span>{t("macros.noMacros")}</span>;
  }

  return (
    <>
      {/* Macros Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {macros.map((macro) => (
          <Link key={macro.id} href={`/platform/macros/${macro.id}`}>
            <Card className="bg-white transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-2 overflow-hidden truncate whitespace-nowrap font-semibold text-gray-900">
                      {macro.name}
                    </h3>
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getLanguageColor(
                        macro.language,
                      )}`}
                    >
                      {getLanguageDisplay(macro.language)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {macro.description && (
                  <p className="line-clamp-2 text-sm text-gray-600">{macro.description}</p>
                )}

                <div className="space-y-2 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{macro.createdByName ?? t("common.unknown")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {t("common.updated")} {formatDate(macro.updatedAt)}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  className="mt-6 h-auto w-full justify-between p-0 font-normal text-gray-700 hover:text-gray-900"
                >
                  {t("macros.viewDetails")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
