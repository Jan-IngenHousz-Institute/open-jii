"use client";

import React from "react";
import type { UseFormReturn } from "react-hook-form";

import { useTranslation } from "@repo/i18n";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";

import type { Registration } from "./registration-form";

export function RegistrationFields({
  form,
  isPending,
  needsEmailVerification,
  termsData,
  emailOnly = false,
}: {
  form: UseFormReturn<Registration>;
  isPending: boolean;
  needsEmailVerification: boolean;
  termsData: { title: React.ReactNode; content: React.ReactNode };
  emailOnly?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      {/* Email – shown when the user needs to supply or verify an email address */}
      {needsEmailVerification && (
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("registration.email")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder={t("registration.emailPlaceholder")}
                  className="h-12 rounded-xl"
                  disabled={isPending}
                />
              </FormControl>
              <FormDescription>{t("registration.emailDescription")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Full profile fields — hidden when only re-collecting a missing email */}
      {!emailOnly && (
        <>
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("registration.firstName")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t("registration.firstNamePlaceholder")}
                    className="h-12 rounded-xl"
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Last name */}
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("registration.lastName")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t("registration.lastNamePlaceholder")}
                    className="h-12 rounded-xl"
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Organization */}
          <FormField
            control={form.control}
            name="organization"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("registration.organization")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t("registration.organizationPlaceholder")}
                    className="h-12 rounded-xl"
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}

      {/* Terms — not required when only re-collecting email */}
      {!emailOnly && (
        <FormField
          control={form.control}
          name="acceptedTerms"
          render={({ field }) => (
            <FormItem className="flex items-end space-x-2">
              <FormControl>
                <Checkbox
                  id={field.name}
                  name={field.name}
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                  ref={field.ref}
                  disabled={isPending}
                  onBlur={field.onBlur}
                />
              </FormControl>
              <FormLabel className="left text-sm font-medium leading-none">
                {t("auth.termsPrefix")}
                <Dialog>
                  <DialogTrigger asChild>
                    <button type="button" className="cursor-pointer underline">
                      {t("auth.terms")}
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{termsData.title}</DialogTitle>
                      <DialogDescription className="sr-only">
                        {t("auth.terms")}
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-64 w-full rounded-md border p-4">
                      {termsData.content}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}
