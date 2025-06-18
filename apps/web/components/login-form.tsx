import { redirect } from "next/navigation";

import { AuthError, providerMap, signIn } from "@repo/auth/next";
import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";
import { Button } from "@repo/ui/components";

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
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">{t("auth.loginToAccount")}</h1>
      </div>
      <div className="grid gap-6">
        <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
          <span className="bg-background text-muted-foreground relative z-10 px-3">
            {t("auth.continueWith")}
          </span>
        </div>
        {providerMap.map((provider) => (
          <form
            key={provider.id}
            action={async () => {
              "use server";
              try {
                await signIn(provider.id, {
                  redirectTo: callbackUrl,
                });
              } catch (error) {
                // Signin can fail for a number of reasons, such as the user
                // not existing, or the user not having the correct role.
                // In some cases, you may want to redirect to a custom error
                if (error instanceof AuthError) {
                  return redirect(`${SIGNIN_ERROR_URL}?error=${error.type}`);
                }

                // Otherwise if a redirects happens Next.js can handle it
                // so you can just re-thrown the error and let Next.js handle it.
                // Docs:
                // https://nextjs.org/docs/app/api-reference/functions/redirect#server-component
                throw error;
              }
            }}
          >
            <Button variant="outline" className="w-full" type="submit">
              <ProviderImage id={provider.id} />
              {t("auth.loginWith", { provider: provider.name })}
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}

function ProviderImage({ id }: { id: string }) {
  switch (id) {
    case "github":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path
            d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
            fill="currentColor"
          />
        </svg>
      );
  }
  return null;
}
