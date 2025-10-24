import { providerMap } from "@/lib/auth";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

import { LoginProviderForm } from "./login-provider-form";

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">{t("auth.loginToAccount")}</h1>
      </div>
      <div className="grid gap-6">
        <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
          <span className="bg-background text-muted-foreground relative z-10 px-2">
            {t("auth.continueWith")}
          </span>
        </div>
        {providerMap.map((provider, index) => (
          <div key={provider.id}>
            {index > 1 && (
              <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                <span className="bg-background text-muted-foreground relative z-10 px-2">
                  {t("auth.orContinueWith")}
                </span>
              </div>
            )}
            <LoginProviderForm provider={provider} callbackUrl={callbackUrl} />
          </div>
        ))}
      </div>
    </div>
  );
}
