import { draftMode } from "next/headers";
import { getContentfulClients } from "~/lib/contentful";

import { ArticleTileGrid } from "@repo/cms/article";
import { PageBlogPostOrder } from "@repo/cms/lib/__generated/sdk";
import initTranslations from "@repo/i18n/server";

interface BlogPostsSectionProps {
  locale: string;
}

export async function BlogPostsSection({ locale }: BlogPostsSectionProps) {
  const { isEnabled: preview } = await draftMode();
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;

  const { t } = await initTranslations({ locale });
  try {
    const blogPostsData = await gqlClient.pageBlogPostCollection({
      limit: 2,
      locale,
      order: PageBlogPostOrder.PublishedDateDesc,
      preview,
    });

    const posts = blogPostsData.pageBlogPostCollection?.items;

    if (!posts || posts.length === 0) {
      return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-500">
            {t("dashboard.noBlogPosts")}
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto">
        <ArticleTileGrid
          className="md:grid-cols-2 lg:grid-cols-3"
          articles={posts}
          locale={locale}
        />
      </div>
    );
  } catch {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-500">
          {t("dashboard.errorLoadingBlogPosts")}
        </div>
      </div>
    );
  }
}
