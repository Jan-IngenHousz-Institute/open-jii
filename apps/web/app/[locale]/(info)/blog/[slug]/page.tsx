import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getContentfulClients } from "~/lib/contentful";

import { ArticleContent, ArticleHero, ArticleTileGrid } from "@repo/cms/article";
import { Container } from "@repo/cms/container";
import { defaultLocale, locales } from "@repo/i18n/config";
import initTranslations from "@repo/i18n/server";

interface BlogPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

const getBlogDetailData = cache(async (locale: string, slug: string, preview: boolean) => {
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const blogDetailData = await gqlClient.pageBlogDetail({
    locale,
    slug,
    preview,
  });
  return {
    blogPost: blogDetailData.pageBlogPostCollection?.items[0],
    landingPage: blogDetailData.pageLandingCollection?.items[0],
  };
});

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const { isEnabled: preview } = await draftMode();
  const { blogPost } = await getBlogDetailData(locale, slug, preview);

  const languages = Object.fromEntries(
    locales.map((locale) => [locale, locale === defaultLocale ? `/${slug}` : `/${locale}/${slug}`]),
  );
  const metadata: Metadata = {
    alternates: {
      canonical: slug,
      languages,
    },
  };

  if (blogPost?.seoFields) {
    metadata.title = blogPost.seoFields.pageTitle;
    metadata.description = blogPost.seoFields.pageDescription;
    metadata.robots = {
      follow: !blogPost.seoFields.nofollow,
      index: !blogPost.seoFields.noindex,
    };
  }

  return metadata;
}

export default async function Page({ params }: BlogPageProps) {
  const { locale, slug } = await params;
  const { isEnabled: preview } = await draftMode();
  const { t } = await initTranslations({ locale });
  const { blogPost, landingPage } = await getBlogDetailData(locale, slug, preview);
  const relatedPosts = blogPost?.relatedBlogPostsCollection?.items;
  const isFeatured = Boolean(
    blogPost?.slug && landingPage?.featuredBlogPost?.slug === blogPost.slug,
  );

  if (!blogPost) {
    notFound();
  }

  return (
    <div className="py-20">
      <Container>
        <ArticleHero article={blogPost} isFeatured={isFeatured} isReversedLayout={true} />
      </Container>
      <Container className="mt-8 max-w-4xl">
        <ArticleContent article={blogPost} />
      </Container>
      {relatedPosts && relatedPosts.length > 0 && (
        <Container className="mt-8 max-w-5xl">
          <h2 className="mb-4 text-2xl font-medium md:mb-6 md:text-3xl">
            {t("article.relatedArticles")}
          </h2>
          <ArticleTileGrid
            articles={relatedPosts.filter((post): post is NonNullable<typeof post> => !!post?.slug)}
            locale={locale}
          />
        </Container>
      )}
    </div>
  );
}
