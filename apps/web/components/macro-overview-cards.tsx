import { formatDate } from "@/util/date";
import { Calendar, ChevronRight, User } from "lucide-react";
import Link from "next/link";
import React from "react";

import type { Macro } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Badge, Skeleton } from "@repo/ui/components";
import { cva } from "@repo/ui/lib/utils";

const cardVariants = cva(
  "relative flex h-full min-h-[180px] flex-col gap-3 rounded-xl border p-5 transition-all hover:scale-[1.02] hover:shadow-lg",
  {
    variants: {
      featured: {
        true: "border-secondary/30 from-badge-featured bg-gradient-to-br to-white shadow-sm",
        false: "border-gray-200 bg-white",
      },
    },
    defaultVariants: {
      featured: false,
    },
  },
);

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
      return "bg-badge-published";
    case "r":
      return "bg-badge-stale";
    case "javascript":
      return "bg-badge-provisioningFailed";
    default:
      return "bg-badge-archived";
  }
};

export function MacroOverviewCards({ macros, isLoading }: MacroOverviewCardsProps) {
  const { t } = useTranslation(["macro", "common"]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-48" />
        ))}
      </div>
    );
  }

  if (!macros || macros.length === 0) {
    return <span>{t("macros.noMacros")}</span>;
  }

  return (
    <>
      {/* Macros Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {macros.map((macro) => {
          const isPreferred = macro.sortOrder !== null;
          return (
            <Link key={macro.id} href={`/platform/macros/${macro.id}`}>
              <div className={cardVariants({ featured: isPreferred })}>
                <div className="mb-auto">
                  <div className="mb-2 flex items-start gap-2">
                    <h3 className="min-w-0 flex-1 break-words text-base font-semibold text-gray-900 md:text-lg">
                      {macro.name}
                    </h3>
                    {isPreferred && (
                      <div className="shrink-0">
                        <Badge className={"bg-secondary/30 text-primary"}>
                          {t("common.preferred")}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-muted-dark mb-2 inline-block rounded-full px-2 py-1 text-xs font-medium ${getLanguageColor(
                      macro.language,
                    )}`}
                  >
                    {getLanguageDisplay(macro.language)}
                  </span>
                  <div className="mt-2 space-y-2 text-sm text-gray-500">
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
                </div>
                <ChevronRight className="absolute bottom-5 right-5 h-6 w-6 text-gray-900 md:hidden" />
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
