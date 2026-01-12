import { providerMap } from "@/lib/auth";

import initTranslations from "@repo/i18n/server";

import { LoginContent } from "./login-content";
import { TermsAndConditionsDialog } from "./terms-and-conditions-dialog";

export async function LoginForm({ callbackUrl, locale }: { callbackUrl?: string; locale: string }) {
  await initTranslations({ locale, namespaces: ["common"] });
  const emailProvider = providerMap.find((p) => p.id === "email");
  const oauthProviders = providerMap.filter((p) => p.id !== "email");
  const termsData = await TermsAndConditionsDialog({ locale });

  return (
    <LoginContent
      emailProvider={emailProvider}
      oauthProviders={oauthProviders}
      callbackUrl={callbackUrl}
      locale={locale}
      termsData={termsData}
    />
  );
}
