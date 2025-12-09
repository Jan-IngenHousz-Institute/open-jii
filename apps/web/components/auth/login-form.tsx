import { providerMap } from "@/lib/auth";

import initTranslations from "@repo/i18n/server";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ScrollArea,
} from "@repo/ui/components";
import { cva } from "@repo/ui/lib/utils";

import { LoginProviderForm } from "../login-provider-form";
import { TermsAndConditionsDialog } from "./terms-and-conditions-dialog";

export async function LoginForm({ callbackUrl, locale }: { callbackUrl?: string; locale: string }) {
  const { t } = await initTranslations({ locale, namespaces: ["common"] });
  const emailProvider = providerMap.find((p) => p.id === "nodemailer");
  const oauthProviders = providerMap.filter((p) => p.id !== "nodemailer");
  const termsData = await TermsAndConditionsDialog({ locale });

  return (
    <div className="bg-card text-card-foreground ring-border flex min-h-[600px] w-full flex-col rounded-2xl p-8 shadow-lg ring-1 md:p-14">
      {/* Title */}
      <h1 className="mb-4 text-left text-2xl font-bold">{t("auth.loginToAccount")}</h1>

      {/* Beta notice badge */}
      <div className="bg-badge-featured border-badge-featured/40 mb-6 rounded-md border px-3 py-2 text-xs sm:text-sm">
        openJII is still under development and supports now only a small group of beta test users
      </div>

      {/* Email provider */}
      {emailProvider && <LoginProviderForm provider={emailProvider} callbackUrl={callbackUrl} />}

      {/* Divider */}
      {oauthProviders.length > 0 && (
        <div className="my-8 flex items-center">
          <div className="border-surface flex-1 border-t" />
          <span className="bg-card text-muted-foreground mx-2 px-2 text-sm">{t("auth.or")}</span>
          <div className="border-surface flex-1 border-t" />
        </div>
      )}

      {/* OAuth providers */}
      <ProviderGrid providers={oauthProviders} callbackUrl={callbackUrl} locale={locale} />

      <div className="flex-1" />

      {/* Terms */}
      <p className="text-accent-foreground text-left text-xs">
        {t("auth.continueTermsPrefix")}{" "}
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

const providerGridVariants = cva("mb-6 grid w-full grid-cols-1 gap-3", {
  variants: {
    count: {
      1: "",
      2: "md:grid-cols-2",
      3: "md:grid-cols-3",
      many: "md:grid-cols-1",
    },
  },
  defaultVariants: {
    count: 1,
  },
});

function ProviderGrid({
  providers,
  callbackUrl,
}: {
  providers: { id: string; name: string }[];
  callbackUrl: string | undefined;
  locale: string;
}) {
  const count = providers.length;
  const variant = count === 2 ? 2 : count === 3 ? 3 : count > 3 ? "many" : 1;

  return (
    <div className={providerGridVariants({ count: variant })}>
      {providers.map((provider) => (
        <LoginProviderForm
          key={provider.id}
          provider={provider}
          callbackUrl={callbackUrl}
          layoutCount={count}
        />
      ))}
    </div>
  );
}
