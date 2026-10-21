"use client";

import type { UseFormReturn } from "react-hook-form";

import type { ColumnDescription } from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";

import type { SuggestedDescription } from "./column-suggestion-banner";
import { ColumnSuggestionBanner } from "./column-suggestion-banner";
import { ColumnTermField } from "./column-term-field";

interface ColumnDescribeFieldsProps {
  form: UseFormReturn<ColumnDescription>;
  canDescribe: boolean;
  suggestion: SuggestedDescription | null;
  isSuggestionApplied: boolean;
  onUseSuggestion: (suggestion: SuggestedDescription) => void;
}

export function ColumnDescribeFields({
  form,
  canDescribe,
  suggestion,
  isSuggestionApplied,
  onUseSuggestion,
}: ColumnDescribeFieldsProps) {
  const { t } = useTranslation("studyMetadata");
  const isDisabled = !canDescribe;
  const canSuggest = canDescribe && suggestion !== null;

  const handleOptionalChange =
    (onChange: (value: string | null) => void) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value || null);

  return (
    <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
      <p className="text-muted-foreground text-sm">
        {canDescribe ? t("describe.intro") : t("describe.readOnly")}
      </p>

      {canSuggest && (
        <ColumnSuggestionBanner
          suggestion={suggestion}
          isApplied={isSuggestionApplied}
          onUse={() => onUseSuggestion(suggestion)}
        />
      )}

      <div className="space-y-4">
        <FormField
          control={form.control}
          name="trait"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t("describe.trait")}
                <span aria-hidden className="text-destructive ml-1">
                  *
                </span>
                <span className="sr-only"> ({t("describe.required")})</span>
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  disabled={isDisabled}
                  placeholder={t("describe.traitPlaceholder")}
                />
              </FormControl>
              <FormDescription>{t("describe.traitHelp")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <ColumnTermField form={form} name="traitTerm" disabled={isDisabled} />
      </div>

      <div className="space-y-4">
        <FormField
          control={form.control}
          name="method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("describe.method")}</FormLabel>
              <FormControl>
                <Textarea
                  value={field.value ?? ""}
                  disabled={isDisabled}
                  onChange={handleOptionalChange(field.onChange)}
                  placeholder={t("describe.methodPlaceholder")}
                  className="min-h-16"
                />
              </FormControl>
              <FormDescription>{t("describe.methodHelp")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <ColumnTermField form={form} name="methodTerm" disabled={isDisabled} />
      </div>

      <div className="space-y-4">
        <FormField
          control={form.control}
          name="scale"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("describe.scale")}</FormLabel>
              <FormControl>
                <Input
                  value={field.value ?? ""}
                  disabled={isDisabled}
                  onChange={handleOptionalChange(field.onChange)}
                  placeholder={t("describe.scalePlaceholder")}
                />
              </FormControl>
              <FormDescription>{t("describe.scaleHelp")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <ColumnTermField form={form} name="scaleTerm" disabled={isDisabled} />
      </div>

      <FormField
        control={form.control}
        name="unit"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("describe.unit")}</FormLabel>
            <FormControl>
              <Input
                value={field.value ?? ""}
                disabled={isDisabled}
                onChange={handleOptionalChange(field.onChange)}
                placeholder={t("describe.unitPlaceholder")}
              />
            </FormControl>
            <FormDescription>{t("describe.unitHelp")}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
