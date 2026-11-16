import { unstable_cache } from "next/cache";
import { draftMode } from "next/headers";
import { PUBLISHED_CONTENT_SECONDS } from "~/lib/cms-cache";
import { getContentfulClients } from "~/lib/contentful";

import { PageBlogPostOrder } from "@repo/cms/lib/__generated/sdk";
import type { PageBlogPostFieldsFragment } from "@repo/cms/lib/__generated/sdk";
import initTranslations from "@repo/i18n/server";

import { BlogPostTile } from "./blog-post-tile";
import { DashboardSection } from "./dashboard-section";
import { SeeAllLink } from "./see-all-link";

async function fetchLatestPosts(locale: string, preview: boolean) {
  const { previewClient, client } = await getContentfulClients();
  return (preview ? previewClient : client).pageBlogPostCollection({
    limit: 3,
    locale,
    order: PageBlogPostOrder.PublishedDateDesc,
    preview,
  });
}

const getPublishedLatestPosts = unstable_cache(
  (locale: string) => fetchLatestPosts(locale, false),
  ["pageBlogPostCollection"],
  { revalidate: PUBLISHED_CONTENT_SECONDS },
);

interface BlogPostsSectionProps {
  locale: string;
}

/** The three newest posts as one row of image tiles. Absent when the CMS has none to give. */
export async function BlogPostsSection({ locale }: BlogPostsSectionProps) {
  const { isEnabled: preview } = await draftMode();

  const { t } = await initTranslations({ locale });

  const posts: (PageBlogPostFieldsFragment | null)[] = await (
    preview ? fetchLatestPosts(locale, true) : getPublishedLatestPosts(locale)
  )
    .then((data) => data.pageBlogPostCollection?.items ?? [])
    // A CMS outage leaves the home without its posts rather than showing the reader an error.
    .catch((error: unknown) => {
      console.error("Home blog posts failed to load:", error);
      return [];
    });

  const shown = posts.filter((post): post is PageBlogPostFieldsFragment => post !== null);
  if (shown.length === 0) {
    return null;
  }

  const renderTile = (post: PageBlogPostFieldsFragment) => (
    <BlogPostTile key={post.sys.id} post={post} locale={locale} />
  );

  return (
    <DashboardSection
      id="blog-posts"
      title={t("dashboard.recentArticles")}
      action={<SeeAllLink href={`/${locale}/blog`}>{t("dashboard.seeAll")}</SeeAllLink>}
    >
      {/* Sized by the column rather than the window. */}
      <div className="@container">
        <div className="@lg:grid-cols-3 grid grid-cols-1 gap-3">{shown.map(renderTile)}</div>
      </div>
    </DashboardSection>
  );
}
