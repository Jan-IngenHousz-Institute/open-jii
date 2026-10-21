"use client";

import { Sparkles } from "lucide-react";

import type {
  ColumnDescription,
  ColumnTerm,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";

export type SuggestionReason =
  | { kind: "earlier-version"; workbookVersion: number }
  | { kind: "other-experiments"; count: number; origin: "instrument" | "macro" };

export interface SuggestedDescription {
  description: ColumnDescription;
  reason: SuggestionReason;
}

interface ColumnSuggestionBannerProps {
  suggestion: SuggestedDescription;
  isApplied: boolean;
  /** Fills the form with the suggested values. Nothing is saved. */
  onUse: () => void;
}

/** Offers a description for this column, with every value it would fill in and why it matched. */
export function ColumnSuggestionBanner({
  suggestion,
  isApplied,
  onUse,
}: ColumnSuggestionBannerProps) {
  const { t } = useTranslation("studyMetadata");
  const { description, reason } = suggestion;

  const withTerm = (text: string | null, term: ColumnTerm | null) =>
    text && term ? `${text} (${term.id})` : text;

  const traitText = () => {
    const isNoTermFits = description.noTermFits && description.traitTerm === null;
    return isNoTermFits
      ? `${description.trait} (${t("suggestion.noneFits")})`
      : withTerm(description.trait, description.traitTerm);
  };

  const matchLine = () => {
    if (reason.kind === "earlier-version") {
      return t("suggestion.earlierVersion", { version: reason.workbookVersion });
    }
    const key = reason.origin === "macro" ? "suggestion.matchMacro" : "suggestion.matchInstrument";
    return t(key, { count: reason.count });
  };

  const titleKey =
    reason.kind === "earlier-version" ? "suggestion.earlierVersionTitle" : "suggestion.title";

  const renderLine = (label: string, value: string | null) =>
    value && (
      <p>
        <span className="text-foreground font-medium">{label}:</span> {value}
      </p>
    );

  if (isApplied) {
    return (
      <Alert role="status">
        <Sparkles />
        <AlertDescription>{t("suggestion.applied")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert role="status">
      <Sparkles />
      <AlertTitle>{t(titleKey)}</AlertTitle>
      <AlertDescription className="gap-3">
        <div className="space-y-0.5">
          {renderLine(t("describe.trait"), traitText())}
          {renderLine(t("describe.method"), withTerm(description.method, description.methodTerm))}
          {renderLine(t("describe.scale"), withTerm(description.scale, description.scaleTerm))}
          {renderLine(t("describe.unit"), description.unit)}
        </div>
        <p className="text-xs">{matchLine()}</p>
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-xs">{t("suggestion.hint")}</span>
          <Button type="button" size="sm" onClick={onUse}>
            {t("suggestion.use")}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
