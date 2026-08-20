"use client";

import { Globe, Lock } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { FormField, FormItem, FormMessage } from "@repo/ui/components/form";
import { cn } from "@repo/ui/lib/utils";

import type { NewOrganizationFormValues } from "./steps/form-step";

interface NewOrganizationVisibilityCardProps {
  form: UseFormReturn<NewOrganizationFormValues>;
}

/**
 * Whether the organization is listed in the directory. The settings surface's two-card
 * control, duplicated rather than shared: this one is form-bound and decides nothing
 * until the wizard submits, where that one writes on click.
 */
export function NewOrganizationVisibilityCard({ form }: NewOrganizationVisibilityCardProps) {
  const { t } = useTranslation();

  return (
    // `min-w-0` because this card shares a grid row and would otherwise widen it.
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{t("organizations.visibility.title")}</CardTitle>
        <CardDescription>{t("organizations.visibility.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <FormField
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <FormItem>
              {/* Stacked, not side by side: this card already shares a row. */}
              <div
                role="radiogroup"
                aria-label={t("organizations.visibility.title")}
                className="grid gap-3"
              >
                <VisibilityOption
                  icon={Lock}
                  title={t("organizations.visibility.privateLabel")}
                  description={t("organizations.visibility.privateHint")}
                  isSelected={field.value === "private"}
                  onSelect={() => field.onChange("private")}
                />
                <VisibilityOption
                  icon={Globe}
                  title={t("organizations.visibility.publicLabel")}
                  description={t("organizations.visibility.publicHint")}
                  isSelected={field.value === "public"}
                  onSelect={() => field.onChange("public")}
                />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}

function VisibilityOption({
  icon: Icon,
  title,
  description,
  isSelected,
  onSelect,
}: {
  icon: typeof Lock;
  title: string;
  description: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={cn(
        "rounded-md border p-3.5 text-left transition-colors",
        isSelected ? "border-primary bg-primary/5" : "hover:border-primary/60",
      )}
    >
      <span className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="text-sm font-semibold">{title}</span>
        <span
          aria-hidden
          className={cn(
            "ml-auto grid h-4 w-4 shrink-0 place-items-center rounded-full border",
            isSelected ? "border-primary" : "border-input",
          )}
        >
          {isSelected ? <span className="bg-primary h-2 w-2 rounded-full" /> : null}
        </span>
      </span>
      <span className="text-muted-foreground mt-1.5 block text-xs leading-relaxed">
        {description}
      </span>
    </button>
  );
}
