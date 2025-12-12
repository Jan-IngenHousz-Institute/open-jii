import { TranslationsProvider } from "@/components/translations-provider";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContentfulClients } from "~/lib/contentful";

import { ArticleHero, ArticleTileGrid } from "@repo/cms/article";
import { Container } from "@repo/cms/container";
import { PageBlogPostOrder } from "@repo/cms/lib/__generated/sdk";
import { defaultLocale, locales } from "@repo/i18n/config";
import initTranslations from "@repo/i18n/server";

interface LandingPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: LandingPageProps): Promise<Metadata> {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;
  const landingPageData = await gqlClient.pageLanding({
    locale,
    preview,
  });
  const page = landingPageData.pageLandingCollection?.items[0];

  const languages = Object.fromEntries(
    locales.map((locale) => [locale, locale === defaultLocale ? "/" : `/${locale}`]),
  );
  const metadata: Metadata = {
    alternates: {
      canonical: "/",
      languages: languages,
    },
  };
  if (page?.seoFields) {
    metadata.title = page.seoFields.pageTitle;
    metadata.description = page.seoFields.pageDescription;
    metadata.robots = {
      follow: !page.seoFields.nofollow,
      index: !page.seoFields.noindex,
    };
  }

  return metadata;
}

export default async function Page({ params }: LandingPageProps) {
  const { locale } = await params;
  const { isEnabled: preview } = await draftMode();
  const { t, resources } = await initTranslations({ locale });
  const { previewClient, client } = await getContentfulClients();
  const gqlClient = preview ? previewClient : client;

  const landingPageData = await gqlClient.pageLanding({ locale, preview });
  const page = landingPageData.pageLandingCollection?.items[0];

  if (!page) {
    notFound();
  }

  const blogPostsData = await gqlClient.pageBlogPostCollection({
    limit: 6,
    locale,
    order: PageBlogPostOrder.PublishedDateDesc,
    where: {
      slug_not: page.featuredBlogPost?.slug,
    },
    preview,
  });
  const posts = blogPostsData.pageBlogPostCollection?.items;

  if (!page.featuredBlogPost || !posts) {
    return;
  }

  return (
    <TranslationsProvider locale={locale} resources={resources}>
      <div className="from-jii-bright-green/40 relative isolate overflow-hidden bg-gradient-to-br via-white to-white pb-6">
        {/* Background skew block */}
        <div
          aria-hidden="true"
          className="shadow-primary/10 ring-jii-bright-green/20 absolute inset-y-0 right-1/2 -z-10 -mr-96 w-[200%] origin-top-right skew-x-[-30deg] bg-white shadow-xl ring-1 sm:-mr-80 lg:-mr-96"
        />

        <div className="pt-20">
          <Container>
            <Link href={`/${locale}/blog/${page.featuredBlogPost.slug}`}>
              <ArticleHero article={page.featuredBlogPost} isFeatured={true} />
            </Link>
          </Container>

          <Container className="my-8">
            <h2 className="mb-4 text-2xl font-medium md:mb-6 md:text-3xl">
              {t("landingPage.latestArticles")}
            </h2>
            <ArticleTileGrid
              className="md:grid-cols-2 lg:grid-cols-3"
              articles={posts}
              locale={locale}
            />
          </Container>
        </div>
      </div>
    </TranslationsProvider>
  );
}
