import { DocsHelpLink } from "@/components/docs-help-link";
import { PageContainer } from "@/components/page-container";
import type { Metadata } from "next";

import initTranslations from "@repo/i18n/server";

import NewOrganizationContent from "./new-organization-content";

interface NewOrganizationPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: NewOrganizationPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("organizations.createAction") };
}

/**
 * The same shape as the other creation routes: a reading-width column with a modest
 * heading over it, rather than the page title a listing gets. The organizations layout
 * is full-width for the grids and tables nested under it, so this route opts back into
 * the narrow column the wizard is designed for.
 */
export default async function NewOrganizationPage({ params }: NewOrganizationPageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return (
    <PageContainer width="reading" className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("organizations.createAction")}</h3>
        <p className="text-muted-foreground text-sm">{t("organizations.listDescription")}</p>
        <div className="mt-2">
          <DocsHelpLink path="/guide/organizations" />
        </div>
      </div>
      <NewOrganizationContent />
    </PageContainer>
  );
}
