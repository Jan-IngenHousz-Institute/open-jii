import { draftMode } from "next/headers";
import { getContentfulClients } from "~/lib/contentful";

import { ArticleTileGrid } from "@repo/cms/article";
import { PageBlogPostOrder } from "@repo/cms/lib/__generated/sdk";

interface BlogPostsSectionProps {
  locale: string;
}

export async function BlogPostsSection({ locale }: BlogPostsSectionProps) {
  const { isEnabled: preview } = await draftMode();
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;

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
            No blog posts available
          </div>
        </div>
      );
    }

    return (
      <ArticleTileGrid
        className="grid-cols-1 md:grid-cols-2 lg:grid-cols-2"
        articles={posts}
        locale={locale}
        horizontal
      />
    );
  } catch {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-500">
          Error loading blog posts
        </div>
      </div>
    );
  }
}
