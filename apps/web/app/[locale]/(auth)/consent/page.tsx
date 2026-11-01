import { PublicNavbar } from "@/components/navigation/public-navbar";
import type { SearchParamsType } from "@/util/searchParams";
import { getFirstSearchParam } from "@/util/searchParams";
import { AuthBackground } from "~/components/auth/auth-background";
import { OAuthConsentForm } from "~/components/auth/oauth-consent-form";

export default async function ConsentPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParamsType;
}) {
  const { locale } = await props.params;
  const query = await props.searchParams;
  return (
    <>
      <PublicNavbar locale={locale} />
      <AuthBackground alt="" />
      <main className="relative z-10 flex min-h-[calc(100svh-4rem)] items-center justify-center p-6">
        <OAuthConsentForm
          clientId={getFirstSearchParam(query.client_id)}
          scope={getFirstSearchParam(query.scope) ?? ""}
        />
      </main>
    </>
  );
}
