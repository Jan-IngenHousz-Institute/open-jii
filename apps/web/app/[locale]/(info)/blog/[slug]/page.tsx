import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
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

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const { isEnabled: preview } = await draftMode();
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;

  const { pageBlogPostCollection } = await gqlClient.pageBlogPost({
    locale,
    slug,
    preview,
  });
  const blogPost = pageBlogPostCollection?.items[0];

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
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const { t } = await initTranslations({ locale });
  const { pageBlogPostCollection } = await gqlClient.pageBlogPost({
    locale,
    slug,
    preview,
  });
  const { pageLandingCollection } = await gqlClient.pageLanding({
    locale,
    preview,
  });
  const landingPage = pageLandingCollection?.items[0];
  const blogPost = pageBlogPostCollection?.items[0];
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
