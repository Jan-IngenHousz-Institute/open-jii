import Image from "next/image";
import { redirect } from "next/navigation";
import type { SearchParamsType } from "~/util/searchParams";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

export default async function VerifyRequestPage(props: {
  params: Promise<{ locale: Locale }>;
  searchParams: SearchParamsType;
}) {
  const { locale } = await props.params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });
  const { provider } = await props.searchParams;
  if (!provider) {
    redirect(`/${locale}/`);
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-96">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">{t("auth.verifyRequest")}</h1>
                <p>{t("auth.verifyRequestDetails")}</p>
                <p>{t("auth.verifyRequestDetailsJunk")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <Image
          src="/placeholder.svg"
          width={300}
          height={300}
          alt="Image"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  );
}
