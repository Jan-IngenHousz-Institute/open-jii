"use client";

import { useOrganizationSlugAvailability } from "@/hooks/organization/useOrganizationSlugAvailability/useOrganizationSlugAvailability";
import { useDebounce } from "@/hooks/useDebounce";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { organizationSlugRejection, suggestOrganizationSlug } from "~/util/organization-slug";

import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
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

import { ORGANIZATION_TYPES, organizationTypeLabelKey } from "../organizations/organization-labels";
import type { NewOrganizationFormValues } from "./steps/form-step";
import { NO_TYPE } from "./steps/form-step";

interface NewOrganizationIdentityCardProps {
  form: UseFormReturn<NewOrganizationFormValues>;
  /**
   * Slugs the server has answered "taken" for. The step's schema reads this same set,
   * so an answer that lands here also refuses to advance the step.
   */
  takenSlugs: Set<string>;
}

export function NewOrganizationIdentityCard({
  form,
  takenSlugs,
}: NewOrganizationIdentityCardProps) {
  const { t } = useTranslation();

  const slug = form.watch("slug");
  const [isSlugEdited, setIsSlugEdited] = useState(false);

  const [debouncedSlug, isSlugDebounced] = useDebounce(slug);
  // Only ask the server about a slug it could actually accept.
  const canCheckAvailability = organizationSlugRejection(slug) === null && debouncedSlug === slug;
  const { data: isSlugAvailable, isFetching: isCheckingSlug } = useOrganizationSlugAvailability(
    debouncedSlug,
    { enabled: canCheckAvailability },
  );

  // A taken slug has to reach the schema, not only the eye: the set is what the
  // refinement reads, and re-validating the field is what turns the answer into a
  // message. Slugs are only ever added — one that was taken while this form was open
  // stays refused until it is typed differently, which is the safe direction to err in.
  useEffect(() => {
    if (!canCheckAvailability || isSlugAvailable !== false) return;
    takenSlugs.add(debouncedSlug);
    void form.trigger("slug");
  }, [canCheckAvailability, isSlugAvailable, debouncedSlug, takenSlugs, form]);

  const isSlugSettled = canCheckAvailability && isSlugDebounced && !isCheckingSlug;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("organizations.create.identityTitle")}</CardTitle>
        <CardDescription>{t("organizations.create.identityDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("organizations.fields.name")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onChange={(event) => {
                    field.onChange(event);
                    // The slug follows the name until it is edited by hand, then it is
                    // the user's. Validated only once the slug has already complained,
                    // so a name that has not yet reduced to a slug is not scolded for it.
                    if (!isSlugEdited) {
                      form.setValue("slug", suggestOrganizationSlug(event.target.value), {
                        shouldValidate: form.getFieldState("slug", form.formState).invalid,
                      });
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t("organizations.fields.slug")}</FormLabel>
              {/* The indicator sits beside the control rather than around it: a wrapper
                  inside `FormControl` would take the id the label points at. */}
              <div className="relative">
                <FormControl>
                  <Input
                    {...field}
                    onChange={(event) => {
                      setIsSlugEdited(true);
                      field.onChange(event);
                    }}
                    aria-invalid={fieldState.invalid}
                  />
                </FormControl>
                {isSlugSettled && isSlugAvailable === true ? (
                  <Check
                    aria-label={t("organizations.slug.available")}
                    className="text-primary absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  />
                ) : canCheckAvailability && isCheckingSlug ? (
                  <Loader2
                    aria-label={t("organizations.slug.checking")}
                    className="text-muted-foreground absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin"
                  />
                ) : null}
              </div>
              {fieldState.error ? (
                <FormMessage />
              ) : (
                <FormDescription>{t("organizations.slug.hint")}</FormDescription>
              )}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("organizations.fields.type")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NO_TYPE}>{t("organizations.types.unspecified")}</SelectItem>
                  {ORGANIZATION_TYPES.map((organizationType) => (
                    <SelectItem key={organizationType} value={organizationType}>
                      {t(organizationTypeLabelKey(organizationType))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
