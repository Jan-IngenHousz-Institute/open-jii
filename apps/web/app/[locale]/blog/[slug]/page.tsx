import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";

import { ArticleContent, ArticleHero, ArticleTileGrid } from "@repo/cms/article";
import { Container } from "@repo/cms/container";
import { client, previewClient } from "@repo/cms/lib/client";
import type { Locale } from "@repo/i18n/config";
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

export async function generateStaticParams({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ locale: string; slug: string }[]> {
  const { locale } = await params;
  const gqlClient = client;
  const { pageBlogPostCollection } = await gqlClient.pageBlogPostCollection({
    locale,
    limit: 100,
  });

  if (!pageBlogPostCollection?.items) {
    throw new Error("No blog posts found");
  }

  return pageBlogPostCollection.items
    .filter((blogPost): blogPost is NonNullable<typeof blogPost> => Boolean(blogPost?.slug))
    .map((blogPost) => {
      return {
        locale,
        slug: blogPost.slug ?? "",
      };
    });
}

export default async function Page({ params }: BlogPageProps) {
  const { locale, slug } = await params;
  const { isEnabled: preview } = await draftMode();
  const gqlClient = preview ? previewClient : client;
  const { t } = await initTranslations({ locale: locale as Locale });
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
    <>
      <Container>
        <ArticleHero article={blogPost} isFeatured={isFeatured} isReversedLayout={true} />
      </Container>
      <Container className="mt-8 max-w-4xl">
        <ArticleContent article={blogPost} />
      </Container>
      {relatedPosts && (
        <Container className="mt-8 max-w-5xl">
          <h2 className="mb-4 text-2xl font-medium md:mb-6 md:text-3xl">
            {t("article.relatedArticles")}
          </h2>
          <ArticleTileGrid className="md:grid-cols-2" articles={relatedPosts} locale={locale} />
        </Container>
      )}
    </>
  );
}
