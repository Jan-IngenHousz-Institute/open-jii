"use client";

import React from "react";
import type { UseFormReturn } from "react-hook-form";

import type { CreateMacroRequestBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("newMacro.detailsTitle")}</CardTitle>
        <CardDescription>{t("newMacro.detailsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
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
      </CardContent>
    </Card>
  );
}
