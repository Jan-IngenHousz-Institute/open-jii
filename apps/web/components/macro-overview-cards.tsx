import { useMacroCompatibleProtocols } from "@/hooks/macro/useMacroCompatibleProtocols/useMacroCompatibleProtocols";
import { useLocale } from "@/hooks/useLocale";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import React, { useMemo, useState } from "react";

import type { Macro, MacroProtocolEntry } from "@repo/api/schemas/macro.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";
import { Skeleton } from "@repo/ui/components/skeleton";
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
      return "bg-badge";
    default:
      return "bg-badge-archived";
  }
};

function CompatibleProtocolsList({ macroId, enabled }: { macroId: string; enabled: boolean }) {
  const { data } = useMacroCompatibleProtocols(macroId, enabled);
  const protocols: MacroProtocolEntry[] = useMemo(
    () => (data?.body as MacroProtocolEntry[] | undefined) ?? [],
    [data],
  );

  if (protocols.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {protocols.map((entry) => (
        <span
          key={entry.protocol.id}
          className="inline-block truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600"
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
    <Link
      href={`/${locale}/platform/macros/${macro.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={cardVariants({ featured: isPreferred })}>
        <div className="inline-flex gap-1">
          <Badge className={getLanguageColor(macro.language)}>
            {getLanguageDisplay(macro.language)}
          </Badge>
          {isPreferred && (
            <Badge className="bg-secondary/30 text-primary">{t("common.preferred")}</Badge>
          )}
        </div>
        <div className="mb-auto">
          <h3 className="mb-2 line-clamp-2 break-words text-base font-semibold text-gray-900 md:text-lg">
            {macro.name}
          </h3>
          <div className="overflow-hidden text-sm text-gray-500">
            <RichTextRenderer content={macro.description ?? " "} truncate maxLines={2} />
          </div>
        </div>
        <CompatibleProtocolsList macroId={macro.id} enabled={hovered} />
        <p className="text-xs text-gray-400">
          {t("macros.lastUpdate")}: {new Date(macro.updatedAt).toLocaleDateString()}
        </p>
        <ChevronRight className="absolute bottom-5 right-5 h-6 w-6 text-gray-900 md:hidden" />
      </div>
    </Link>
  );
}

export function MacroOverviewCards({ macros, isLoading }: MacroOverviewCardsProps) {
  const { t } = useTranslation(["macro", "common"]);
  const locale = useLocale();

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
    return (
      <div className="text-[0.9rem] font-normal leading-[1.3125rem] text-[#68737B]">
        {t("macros.noMacros")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {macros.map((macro) => (
        <MacroCard key={macro.id} macro={macro} locale={locale} t={t} />
      ))}
    </div>
  );
}
