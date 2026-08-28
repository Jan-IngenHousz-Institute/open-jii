"use client";

import { orpc } from "@/lib/orpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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

// Public footer subscribe form. The anonymous double-opt-in endpoint always
// returns generic success, so the success state is "check your inbox to
// confirm". Any error (incl. 429 rate limit) collapses to one generic message.
export function NewsletterSubscribeForm() {
  const { t } = useTranslation("newsletter");
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Trim in the schema (not only via the Input's onBlur `trim`) so pressing
  // Enter with surrounding whitespace validates the same as a mouse submit.
  const schema = z.object({
    email: z.string().trim().email(t("footer.invalidEmail")),
  });
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const { mutate: subscribe, isPending } = useMutation(
    orpc.newsletter.subscribe.mutationOptions({
      onSuccess: () => {
        setHasError(false);
        setIsSuccess(true);
        form.reset();
      },
      onError: () => {
        setHasError(true);
      },
    }),
  );

  const onSubmit = (data: FormValues) => {
    setHasError(false);
    subscribe(data);
  };

  if (isSuccess) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="text-slab-foreground flex items-start gap-2 text-sm"
      >
        <CheckCircle2 className="text-slab-primary mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">{t("footer.successTitle")}</p>
          <p className="text-slab-foreground/80">{t("footer.successMessage")}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-slab-foreground mb-1 font-extrabold">{t("footer.title")}</h4>
      <p className="text-slab-foreground/80 mb-3 text-sm">{t("footer.description")}</p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2" noValidate>
          <div className="flex flex-col gap-2 sm:flex-row">
            <FormField
              control={form.control}
              name="email"
              disabled={isPending}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="sr-only">{t("footer.emailLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder={t("footer.emailPlaceholder")}
                      className="bg-card text-card-foreground placeholder:text-muted-foreground"
                      trim
                      {...field}
                    />
                  </FormControl>
                  <FormMessage role="alert" className="text-slab-primary" />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={isPending}
              className="shrink-0 font-semibold"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {isPending ? t("footer.submitting") : t("footer.submit")}
            </Button>
          </div>
          {hasError && (
            <p role="alert" className="text-destructive text-sm">
              {t("footer.errorMessage")}
            </p>
          )}
        </form>
      </Form>
    </div>
  );
}
