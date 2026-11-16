import { unstable_cache } from "next/cache";
import { PUBLISHED_CONTENT_SECONDS } from "~/lib/cms-cache";
import { getContentfulClients } from "~/lib/contentful";

async function fetchTermsAndConditions(locale: string, preview: boolean) {
  const { previewClient, client } = await getContentfulClients();
  return (preview ? previewClient : client).pageTermsAndConditions({ locale, preview });
}

const getPublishedTermsAndConditions = unstable_cache(
  (locale: string) => fetchTermsAndConditions(locale, false),
  ["page-terms-and-conditions"],
  { revalidate: PUBLISHED_CONTENT_SECONDS },
);

export function getTermsAndConditions(locale: string, preview: boolean) {
  return preview ? fetchTermsAndConditions(locale, true) : getPublishedTermsAndConditions(locale);
}
