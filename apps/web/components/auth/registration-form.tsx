"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import React from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { handleRegister } from "~/app/actions/auth";
import { useCreateUserProfile } from "~/hooks/profile/useCreateUserProfile/useCreateUserProfile";

import { useTranslation } from "@repo/i18n";
import {
  Button,
  Checkbox,
  Input,
  ScrollArea,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

export function RegistrationForm({
  callbackUrl,
  termsData,
}: {
  callbackUrl?: string;
  termsData: { title: React.ReactNode; content: React.ReactNode };
}) {
  const { t } = useTranslation();
  const router = useRouter();

  const registrationSchema = z
    .object({
      firstName: z.string().min(2, t("registration.firstNameError")),
      lastName: z.string().min(2, t("registration.lastNameError")),
      organization: z.string().optional(),
      acceptedTerms: z.boolean(),
    })
    .superRefine(({ acceptedTerms }, ctx) => {
      if (!acceptedTerms) {
        ctx.addIssue({
          code: "custom",
          message: t("registration.acceptTermsError"),
          path: ["acceptedTerms"],
        });
      }
    });

  type Registration = z.infer<typeof registrationSchema>;

  const form = useForm<Registration>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      organization: "",
      acceptedTerms: false,
    },
  });

  const { mutate: createUserProfile } = useCreateUserProfile({
    onSuccess: async () => {
      await handleRegister();
      toast({ description: t("registration.successMessage") });
      router.push(callbackUrl ?? "/");
    },
  });

  function onSubmit(data: Registration) {
    createUserProfile({
      body: {
        firstName: data.firstName,
        lastName: data.lastName,
        organization: data.organization,
      },
    });
  }

  return (
    <div className="bg-card text-card-foreground ring-border flex h-full min-h-[600px] w-full flex-col rounded-2xl p-6 shadow-lg ring-1 lg:w-[460px] lg:rounded-2xl lg:p-10 lg:shadow-lg lg:ring-1">
      {/* Title */}
      <div className="mb-4 text-left">
        <h1 className="text-2xl font-bold">{t("registration.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("registration.description")}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* First name */}
          <div className="space-y-2">
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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Last name */}
          <div className="space-y-2">
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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Organization */}
          <div className="space-y-2">
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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Terms */}
          <div className="space-y-3">
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
                      disabled={field.disabled}
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
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary-light active:bg-primary-dark h-12 w-full rounded-xl"
          >
            {t("registration.register")}
          </Button>
        </form>
      </Form>

      <div className="flex-1" />
    </div>
  );
}
