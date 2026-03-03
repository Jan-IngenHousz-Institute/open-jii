"use client";

import React from "react";
import type { UseFormReturn } from "react-hook-form";

import type { CreateMacroRequestBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  RichTextarea,
} from "@repo/ui/components";

interface NewMacroDetailsCardProps {
  form: UseFormReturn<CreateMacroRequestBody>;
}

export function NewMacroDetailsCard({ form }: NewMacroDetailsCardProps) {
  const { t } = useTranslation("macro");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("newMacro.detailsTitle")}</h3>
        <p className="text-muted-foreground text-sm">{t("newMacro.detailsDescription")}</p>
      </div>
      {/* Macro Name */}
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("newMacro.name")}</FormLabel>
            <FormControl>
              <Input {...field} trim />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Description */}
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("newMacro.description")}</FormLabel>
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
