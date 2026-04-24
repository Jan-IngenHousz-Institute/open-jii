"use client";

import React from "react";
import type { UseFormReturn } from "react-hook-form";

import type { CreateMacroRequestBody } from "@repo/api/schemas/macro.schema";
import { useTranslation } from "@repo/i18n";
import { FormControl, FormField, FormItem, FormMessage } from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { RichTextarea } from "@repo/ui/components/rich-textarea";

interface NewMacroDetailsCardProps {
  form: UseFormReturn<CreateMacroRequestBody>;
}

export function NewMacroDetailsCard({ form }: NewMacroDetailsCardProps) {
  const { t } = useTranslation("macro");

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input {...field} trim placeholder={t("newMacro.name")} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <RichTextarea
                value={field.value ?? ""}
                onChange={field.onChange}
                placeholder={t("newMacro.description")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
