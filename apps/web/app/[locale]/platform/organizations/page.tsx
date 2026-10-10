import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { organizationsListQuery } from "@/hooks/organization/useOrganizations/organizations-list-query";
import type { Metadata } from "next";
import { auth } from "~/app/actions/auth";

import initTranslations from "@repo/i18n/server";

import OrganizationsListContent from "./organizations-list-content";

interface OrganizationsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string }>;
}

export async function generateMetadata({
  params,
}: Pick<OrganizationsPageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations({ locale, namespaces: ["common"] });

  return { title: t("organizations.title") };
}

export default async function OrganizationsPage({ searchParams }: OrganizationsPageProps) {
  // Only the unfiltered, unsorted directory is fetched ahead; other views come from the client.
  const [{ q, sort }, session] = await Promise.all([searchParams, auth()]);
  const isDefaultView = !q && !sort;

  return (
    <PrefetchedQueries
      queries={(utils) =>
        isDefaultView ? [organizationsListQuery(utils, session?.user.id, { scope: "all" })] : []
      }
    >
      <OrganizationsListContent />
    </PrefetchedQueries>
  );
}
