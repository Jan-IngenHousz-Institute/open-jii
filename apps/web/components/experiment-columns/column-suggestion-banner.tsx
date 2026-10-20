"use client";

import { Sparkles } from "lucide-react";

import type {
  ColumnDescription,
  ColumnSuggestion,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";

interface ColumnSuggestionBannerProps {
  suggestion: ColumnSuggestion;
  isPending: boolean;
  /** Saves the suggestion exactly as a typed description. */
  onAccept: (description: ColumnDescription) => void;
}

/** Offers what other experiments accepted for this column; nothing is saved until Accept. */
export function ColumnSuggestionBanner({
  suggestion,
  isPending,
  onAccept,
}: ColumnSuggestionBannerProps) {
  const { t } = useTranslation("studyMetadata");
  const { trait, method, scale } = suggestion.description;

  const handleAccept = () => onAccept(suggestion.description);

  const renderLine = (label: string, value: string | null) =>
    value && (
      <p>
        <span className="text-foreground font-medium">{label}:</span> {value}
      </p>
    );

  return (
    <Alert role="status">
      <Sparkles />
      <AlertTitle>{t("suggestion.title")}</AlertTitle>
      <AlertDescription className="gap-3">
        <div className="space-y-0.5">
          {renderLine(t("describe.trait"), trait)}
          {renderLine(t("describe.method"), method)}
          {renderLine(t("describe.scale"), scale)}
        </div>
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-xs">
            {t("suggestion.usedBy", { count: suggestion.experimentCount })}
          </span>
          <Button type="button" size="sm" disabled={isPending} onClick={handleAccept}>
            {t("suggestion.accept")}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
