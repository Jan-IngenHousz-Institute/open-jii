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
  ScrollArea,
} from "@repo/ui/components";

import { TermsAndConditionsDialog } from "./terms-and-conditions-dialog";

const SIGNIN_ERROR_URL = "/error";

export async function LoginForm({ callbackUrl, locale }: { callbackUrl?: string; locale: Locale }) {
  const { t } = await initTranslations({ locale, namespaces: ["common"] });
  const emailProvider = providerMap.find((p) => p.id === "nodemailer");
  const oauthProviders = providerMap.filter((p) => p.id !== "nodemailer");
  const termsData = await TermsAndConditionsDialog({ locale });

  return (
    <div className="bg-card text-card-foreground ring-border flex min-h-[600px] w-full flex-col rounded-2xl p-8 shadow-lg ring-1 lg:w-[460px] lg:p-14">
      {/* Title */}
      <h1 className="mb-4 text-left text-2xl font-bold">{t("auth.loginToAccount")}</h1>

      {/* Email provider */}
      {emailProvider && (
        <ProviderForm provider={emailProvider} callbackUrl={callbackUrl} withEmail t={t} />
      )}

      {/* Divider */}
      {oauthProviders.length > 0 && (
        <div className="my-8 flex items-center">
          <div className="border-surface flex-1 border-t" />
          <span className="bg-card text-muted-foreground mx-2 px-2 text-sm">{t("auth.or")}</span>
          <div className="border-surface flex-1 border-t" />
        </div>
      )}

      {/* OAuth providers */}
      {renderProviders(oauthProviders, callbackUrl, t)}

      <div className="flex-1" />

      {/* Terms */}
      <p className="text-accent-foreground text-left text-xs">
        {t("auth.continueTermsPrefix")}
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
      </p>
    </div>
  );
}

/* ---------- Helpers ---------- */

function ProviderForm({
  provider,
  callbackUrl,
  children,
  withEmail,
  t,
}: {
  provider: { id: string };
  callbackUrl?: string;
  children?: React.ReactNode;
  withEmail?: boolean;
  t?: (key: string) => string;
}) {
  return (
    <form
      key={provider.id}
      action={async (formData) => {
        "use server";
        try {
          if (withEmail) {
            const email = formData.get("email") as string | null;
            if (!email) throw new Error("Email is required");
            await signIn(provider.id, { redirectTo: callbackUrl, email });
          } else {
            await signIn(provider.id, { redirectTo: callbackUrl });
          }
        } catch (error) {
          if (error instanceof AuthError) {
            return redirect(`${SIGNIN_ERROR_URL}?error=${error.type}`);
          }
          throw error;
        }
      }}
      className="w-full"
    >
      {withEmail ? (
        <>
          <div className="my-4 grid gap-2">
            <Label htmlFor="email" className="text-sm">
              {t?.("auth.email")}
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t?.("auth.emailPlaceholder")}
              required
              className="h-12 rounded-xl"
            />
          </div>
          <Button
            type="submit"
            variant="default"
            className="bg-primary text-primary-foreground hover:bg-primary-light active:bg-primary-dark mt-4 h-12 w-full rounded-xl"
          >
            {t?.("auth.continueWithEmail")}
          </Button>
        </>
      ) : (
        children
      )}
    </form>
  );
}

function renderProviders(
  providers: { id: string }[],
  callbackUrl?: string,
  t?: (key: string) => string,
) {
  const count = providers.length;

  // layout rules:
  // 2 → two cols
  // 3 → three cols
  // >3 → single column
  let gridCols = "";
  if (count === 2) gridCols = "md:grid-cols-2";
  else if (count === 3) gridCols = "md:grid-cols-3";
  else if (count > 3) gridCols = "md:grid-cols-1"; // force single column

  return (
    <div className={`mb-6 grid w-full grid-cols-1 gap-3 ${gridCols}`}>
      {providers.map((provider) => {
        const providerName = provider.id.charAt(0).toUpperCase() + provider.id.slice(1);

        return (
          <ProviderForm key={provider.id} provider={provider} callbackUrl={callbackUrl}>
            <Button
              type="submit"
              variant="outline"
              className="bg-surface text-foreground hover:bg-surface-light active:bg-surface-dark flex h-12 w-full items-center justify-center rounded-full"
              aria-label={provider.id}
            >
              {/* 2 providers */}
              {count === 2 && (
                <>
                  <ProviderImage id={provider.id} className="mr-2 h-5 w-5" />
                  <span className="font-notosans ml-2 md:hidden">{`${t?.("auth.continueWith")} ${providerName}`}</span>
                  <span className="font-notosans hidden md:inline">{providerName}</span>
                </>
              )}

              {/* 3 providers */}
              {count === 3 && (
                <>
                  {/* mobile: icon + label */}
                  <span className="font-notosans flex items-center md:hidden">
                    <ProviderImage id={provider.id} className="mr-2 h-5 w-5" />
                    {`${t?.("auth.continueWith")} ${providerName}`}
                  </span>
                  {/* desktop: icon only, centered */}
                  <span className="hidden w-full items-center justify-center md:flex">
                    <ProviderImage id={provider.id} className="h-5 w-5" />
                  </span>
                </>
              )}

              {/* default: 1 provider OR >3 providers */}
              {count !== 2 && count !== 3 && (
                <>
                  <ProviderImage id={provider.id} className="mr-2 h-5 w-5" />
                  <span className="font-notosans">
                    {t?.(`auth.loginWith-${provider.id}`) ?? providerName}
                  </span>
                </>
              )}
            </Button>
          </ProviderForm>
        );
      })}
    </div>
  );
}

function ProviderImage({ id, className }: { id: string; className?: string }) {
  switch (id) {
    case "github":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={className ?? "mr-2 h-6 w-6"}
          fill="currentColor"
        >
          <path
            d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
            fill="currentColor"
          />
        </svg>
      );
    case "orcid":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={className ?? "mr-2 h-6 w-6"}
        >
          <path
            d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947 0 .525-.422.947-.947.947A.943.943 0 0 1 6.422 5.325c0-.516.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.016-5.325 5.016h-3.919V7.416zm1.444 1.303v7.444h2.297c2.359 0 3.588-1.313 3.588-3.722 0-2.2-1.313-3.722-3.588-3.722h-2.297z"
            fill="#A6CE39"
          />
        </svg>
      );
  }
  return null;
}
