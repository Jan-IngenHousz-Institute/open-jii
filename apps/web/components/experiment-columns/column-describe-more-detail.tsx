"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type {
  ColumnProcessingLevel,
  ColumnValueKind,
  DescribeColumnBody,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import {
  zColumnProcessingLevel,
  zColumnValueKind,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";

import { ColumnTermField } from "./column-term-field";

const VALUE_KIND_KEYS: Record<ColumnValueKind, string> = {
  number: "describe.valueKindNumber",
  count: "describe.valueKindCount",
  category: "describe.valueKindCategory",
  text: "describe.valueKindText",
  trace: "describe.valueKindTrace",
};

const PROCESSING_LEVEL_KEYS: Record<ColumnProcessingLevel, string> = {
  measured: "describe.processingLevelMeasured",
  calibrated: "describe.processingLevelCalibrated",
  computed: "describe.processingLevelComputed",
};

const NOT_SET = "none";

interface ColumnDescribeMoreDetailProps {
  form: UseFormReturn<DescribeColumnBody>;
  disabled: boolean;
}

/** The optional parts of a description, collapsed so describing a column stays quick. */
export function ColumnDescribeMoreDetail({ form, disabled }: ColumnDescribeMoreDetailProps) {
  const { t } = useTranslation("studyMetadata");
  const [isOpen, setIsOpen] = useState(false);

  const valueKind = (value: string) => zColumnValueKind.safeParse(value).data ?? null;
  const processingLevel = (value: string) => zColumnProcessingLevel.safeParse(value).data ?? null;

  const handleContextChange =
    (onChange: (value: string | null) => void) => (event: React.ChangeEvent<HTMLInputElement>) =>
      onChange(event.target.value || null);

  const renderValueKind = (kind: ColumnValueKind) => (
    <SelectItem key={kind} value={kind}>
      {t(VALUE_KIND_KEYS[kind])}
    </SelectItem>
  );

  const renderProcessingLevel = (level: ColumnProcessingLevel) => (
    <SelectItem key={level} value={level}>
      {t(PROCESSING_LEVEL_KEYS[level])}
    </SelectItem>
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-t pt-3">
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="-ml-2">
          {t("describe.moreDetail")}
          <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-5 pt-3">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="context"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("describe.context")}</FormLabel>
                  <FormControl>
                    <Input
                      value={field.value ?? ""}
                      disabled={disabled}
                      onChange={handleContextChange(field.onChange)}
                      placeholder={t("describe.contextPlaceholder")}
                    />
                  </FormControl>
                  <FormDescription>{t("describe.contextHelp")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <ColumnTermField form={form} name="contextTerm" disabled={disabled} />
          </div>

          <FormField
            control={form.control}
            name="valueKind"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("describe.valueKind")}</FormLabel>
                <Select
                  value={field.value ?? NOT_SET}
                  disabled={disabled}
                  onValueChange={(value) => field.onChange(valueKind(value))}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NOT_SET}>{t("describe.notSet")}</SelectItem>
                    {zColumnValueKind.options.map(renderValueKind)}
                  </SelectContent>
                </Select>
                <FormDescription>{t("describe.valueKindHelp")}</FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="processingLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("describe.processingLevel")}</FormLabel>
                <Select
                  value={field.value ?? NOT_SET}
                  disabled={disabled}
                  onValueChange={(value) => field.onChange(processingLevel(value))}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NOT_SET}>{t("describe.notSet")}</SelectItem>
                    {zColumnProcessingLevel.options.map(renderProcessingLevel)}
                  </SelectContent>
                </Select>
                <FormDescription>{t("describe.processingLevelHelp")}</FormDescription>
              </FormItem>
            )}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
