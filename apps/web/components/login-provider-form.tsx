"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useTranslation } from "@repo/i18n";
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@repo/ui/components";

import { signInAction } from "../app/actions/auth";

export function LoginProviderForm({
  provider,
  callbackUrl,
}: {
  provider: { id: string; name: string };
  callbackUrl: string | undefined;
}) {
  const isEmailProvider = provider.id === "nodemailer";

  if (isEmailProvider) {
    return <EmailLoginForm callbackUrl={callbackUrl} />;
  }

  return <OAuthLoginForm provider={provider} callbackUrl={callbackUrl} />;
}

function EmailLoginForm({ callbackUrl }: { callbackUrl: string | undefined }) {
  const { t } = useTranslation();
  const [isPending, setIsPending] = useState(false);

  const emailSchema = z.object({
    email: z.string().min(1, t("auth.emailRequired")).email(t("auth.emailInvalid")),
  });

  type EmailFormData = z.infer<typeof emailSchema>;

  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: EmailFormData) {
    if (isPending) return;
    setIsPending(true);

    try {
      await signInAction("nodemailer", callbackUrl, data.email);
    } finally {
      setIsPending(false);
    }
  

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.email")}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          variant="outline"
          className="w-full"
          type="submit"
          disabled={isPending || (!form.formState.isValid && form.formState.isDirty)}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("auth.sendingEmail")}
            </>
          ) : (
            <>
              <ProviderImage id="nodemailer" />
              {t("auth.loginWith-nodemailer")}
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

function OAuthLoginForm({
  provider,
  callbackUrl,
}: {
  provider: { id: string; name: string };
  callbackUrl: string | undefined;
}) {
  const { t } = useTranslation();
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      await signInAction(provider.id, callbackUrl);
    } catch (error) {
      setIsPending(false);
      console.error("Sign in error:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Button variant="outline" className="w-full" type="submit" disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <ProviderImage id={provider.id} />
        {t(`auth.loginWith-${provider.id}`)}
      </Button>
    </form>
  );
}

function ProviderImage({ id }: { id: string }) {
  switch (id) {
    case "github":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
          <path
            d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
            fill="currentColor"
          />
        </svg>
      );
    case "orcid":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
          <path
            d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947 0 .525-.422.947-.947.947A.943.943 0 0 1 6.422 5.325c0-.516.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.016-5.325 5.016h-3.919V7.416zm1.444 1.303v7.444h2.297c2.359 0 3.588-1.313 3.588-3.722 0-2.2-1.313-3.722-3.588-3.722h-2.297z"
            fill="#A6CE39"
          />
        </svg>
      );
  }
  return null;
}
