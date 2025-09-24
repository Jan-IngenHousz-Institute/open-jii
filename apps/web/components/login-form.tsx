import { providerMap, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

import { AuthError } from "@repo/auth/next";
import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";
import { Button, Input, Label } from "@repo/ui/components";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components";
import { ScrollArea } from "@repo/ui/components";

import { TermsAndConditionsDialog } from "./terms-and-conditions-dialog";

const SIGNIN_ERROR_URL = "/error";

export async function LoginForm({
  callbackUrl,
  locale,
}: {
  callbackUrl: string | undefined;
  locale: Locale;
}) {
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  const emailProvider = providerMap.find((p) => p.id === "nodemailer");
  const oauthProviders = providerMap.filter((p) => p.id !== "nodemailer");

  // Fetch terms and conditions data
  const termsData = await TermsAndConditionsDialog({ locale });

  return (
    <div className="bg-card text-card-foreground ring-border flex h-full min-h-[600px] w-full flex-col rounded-2xl p-6 shadow-lg ring-1 lg:w-[460px] lg:rounded-2xl lg:p-10 lg:shadow-lg lg:ring-1">
      {/* Title */}
      <div className="mb-4 text-center">
        <h1 className="text-2xl font-bold">{t("auth.loginToAccount")}</h1>
      </div>

      {/* Email block */}
      {emailProvider && (
        <form
          className="mb-2"
          action={async (formData) => {
            "use server";
            try {
              const email = formData.get("email") as string | null;
              if (!email) throw new Error("Email is required");
              await signIn(emailProvider.id, {
                redirectTo: callbackUrl,
                email,
              });
            } catch (error) {
              if (error instanceof AuthError) {
                return redirect(`${SIGNIN_ERROR_URL}?error=${error.type}`);
              }
              throw error;
            }
          }}
        >
          <div className="grid gap-3">
            <Label htmlFor="email" className="text-sm">
              {t("auth.email", "Email address")}
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="m@example.com"
              required
              className="h-12 rounded-xl"
            />
          </div>

          <Button
            type="submit"
            variant="default"
            className="bg-primary text-primary-foreground mt-4 h-12 w-full rounded-xl hover:opacity-90"
          >
            {t("auth.continueWithEmail")}
          </Button>
        </form>
      )}

      {/* Divider */}
      {oauthProviders.length > 0 && (
        <div className="relative my-6">
          <div className="border-border absolute inset-0 top-1/2 -translate-y-1/2 border-t" />
          <span className="bg-card text-muted-foreground relative mx-auto block w-fit px-2 text-sm">
            {t("auth.or")}
          </span>
        </div>
      )}

      {/* OAuth providers */}
      <div className="grid gap-3">
        {oauthProviders.map((provider) => (
          <form
            key={provider.id}
            action={async () => {
              "use server";
              try {
                await signIn(provider.id, { redirectTo: callbackUrl });
              } catch (error) {
                if (error instanceof AuthError) {
                  return redirect(`${SIGNIN_ERROR_URL}?error=${error.type}`);
                }
                throw error;
              }
            }}
          >
            <Button
              type="submit"
              variant="outline"
              className="bg-accent-light text-foreground hover:bg-accent h-12 w-full rounded-full"
            >
              <ProviderImage id={provider.id} />
              {t(`auth.loginWith-${provider.id}`)}
            </Button>
          </form>
        ))}
      </div>

      <div className="flex-1" />
      {/* Terms and Conditions */}
      <p className="text-muted-foreground text-center text-xs">
        {t("auth.termsPrefix")}
        <Dialog>
          <DialogTrigger asChild>
            <a className="cursor-pointer underline" href="#">
              {t("auth.terms")}
            </a>
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
      </p>
    </div>
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
}
