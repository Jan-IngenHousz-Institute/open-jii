"use client";

import type { UseFormReturn } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";

import type { NewOrganizationFormValues } from "./steps/form-step";

interface NewOrganizationProfileCardProps {
  form: UseFormReturn<NewOrganizationFormValues>;
}

export function NewOrganizationProfileCard({ form }: NewOrganizationProfileCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("organizations.create.profileTitle")}</CardTitle>
        <CardDescription>{t("organizations.create.profileDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plain text, like the settings form's own description field: an organization's
            description is rendered as text everywhere it appears. */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("organizations.fields.description")}</FormLabel>
              <FormControl>
                <Textarea {...field} className="min-h-24" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="website"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t("organizations.fields.website")}</FormLabel>
                <FormControl>
                  <Input {...field} type="url" aria-invalid={fieldState.invalid} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("organizations.fields.location")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
