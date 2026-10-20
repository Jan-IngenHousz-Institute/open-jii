"use client";

import { useExperimentColumnDescribe } from "@/hooks/experiment/useExperimentColumnDescribe/useExperimentColumnDescribe";
import { useExperimentColumnSuggestion } from "@/hooks/experiment/useExperimentColumnSuggestion/useExperimentColumnSuggestion";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { parseApiError } from "~/util/apiError";

import type {
  ColumnDescription,
  DictionaryColumn,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { zColumnDescription } from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { toast } from "@repo/ui/hooks/use-toast";

import { ColumnSuggestionBanner } from "./column-suggestion-banner";
import { ColumnTermSearch } from "./column-term-search";

const EMPTY_DESCRIPTION: ColumnDescription = {
  trait: "",
  traitTerm: null,
  method: null,
  methodTerm: null,
  scale: null,
  scaleTerm: null,
  unit: null,
};

interface ColumnDescribeFormProps {
  experimentId: string;
  column: DictionaryColumn;
  onDone: () => void;
}

export function ColumnDescribeForm({ experimentId, column, onDone }: ColumnDescribeFormProps) {
  const { t } = useTranslation("studyMetadata");
  const { mutateAsync: describeColumn, isPending } = useExperimentColumnDescribe();

  // Suggestions are for columns nobody has described yet.
  const isUndescribed = column.description === null;
  const { data: suggestion } = useExperimentColumnSuggestion(
    experimentId,
    column.identity,
    isUndescribed,
  );

  const form = useForm<ColumnDescription>({
    resolver: zodResolver(zColumnDescription),
    defaultValues: column.description ?? EMPTY_DESCRIPTION,
  });

  const handleOptionalChange =
    (onChange: (value: string | null) => void) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value || null);

  const save = async (values: ColumnDescription) => {
    await describeColumn(
      { id: experimentId, column: column.identity, ...values },
      {
        onSuccess: () => {
          toast({ description: t("describe.saved") });
          onDone();
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(save)} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {suggestion && (
            <ColumnSuggestionBanner
              suggestion={suggestion}
              isPending={isPending}
              onAccept={save}
            />
          )}

          <div className="space-y-2">
            <FormField
              control={form.control}
              name="trait"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("describe.trait")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("describe.traitPlaceholder")} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="traitTerm"
              render={({ field }) => (
                <ColumnTermSearch value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          <div className="space-y-2">
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("describe.method")}</FormLabel>
                  <FormControl>
                    <Textarea
                      value={field.value ?? ""}
                      onChange={handleOptionalChange(field.onChange)}
                      placeholder={t("describe.methodPlaceholder")}
                      className="min-h-16"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="methodTerm"
              render={({ field }) => (
                <ColumnTermSearch value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          <div className="space-y-2">
            <FormField
              control={form.control}
              name="scale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("describe.scale")}</FormLabel>
                  <FormControl>
                    <Input
                      value={field.value ?? ""}
                      onChange={handleOptionalChange(field.onChange)}
                      placeholder={t("describe.scalePlaceholder")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="scaleTerm"
              render={({ field }) => (
                <ColumnTermSearch value={field.value} onChange={field.onChange} />
              )}
            />
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
                    onChange={handleOptionalChange(field.onChange)}
                    placeholder={t("describe.unitPlaceholder")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="border-border flex justify-end gap-2 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={onDone}>
            {t("describe.cancel")}
          </Button>
          <Button type="submit" disabled={isPending}>
            {t("describe.save")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
