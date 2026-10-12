import { unstable_cache } from "next/cache";
import { draftMode } from "next/headers";
import { getContentfulClients } from "~/lib/contentful";

import { publicNavigationHref } from "./public-navigation-links";
import type { PublicNavigationLink } from "./public-navigation-links";
import { UnifiedNavbar } from "./unified-navbar/unified-navbar";

async function fetchNavigation(locale: string, preview: boolean) {
  const { client, previewClient } = await getContentfulClients();
  const data = await (preview ? previewClient : client).publicNavigation({ locale, preview });
  const collection = data.footerCollection?.items[0]?.navigationButtonsCollection;
  if (!collection) return null;

  return collection.items.flatMap((item): PublicNavigationLink[] => {
    const label = item?.label?.trim();
    const href = item?.url ? publicNavigationHref(item.url, locale) : null;
    return item && label && href ? [{ id: item.sys.id, label, href }] : [];
  });
}

const getPublishedNavigation = unstable_cache(
  (locale: string) => fetchNavigation(locale, false),
  ["public-navigation"],
  { revalidate: 300 },
);

export async function PublicNavbar({
  locale,
  isHomePage = false,
}: {
  locale: string;
  isHomePage?: boolean;
}) {
  const { isEnabled: preview } = await draftMode();
  let links: PublicNavigationLink[] | null = null;
  try {
    links = await (preview ? fetchNavigation(locale, true) : getPublishedNavigation(locale));
  } catch {
    // Keep home and sign-in reachable if CMS content is unavailable.
  }
  return <UnifiedNavbar locale={locale} isHomePage={isHomePage} links={links} />;
}
