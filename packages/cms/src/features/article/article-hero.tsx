"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";

import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import type { PageBlogPostFieldsFragment } from "../../lib/__generated/sdk";
import { FormatDate } from "../../shared/format-date";
import { CtfImage } from "../contentful";
import { ArticleAuthor } from "./article-author";
import { ArticleLabel } from "./article-label";

interface ArticleHeroProps {
  article: PageBlogPostFieldsFragment;
  isFeatured?: boolean;
  isReversedLayout?: boolean;
  locale?: string;
}

export const ArticleHero: React.FC<ArticleHeroProps> = ({
  article,
  isFeatured,
  isReversedLayout = false,
}) => {
  const { t } = useTranslation();
  const inspectorProps = useContentfulInspectorMode({
    entryId: article.sys.id,
  });
  const { title, shortDescription, publishedDate } =
    useContentfulLiveUpdates<PageBlogPostFieldsFragment>(article) as {
      title: string;
      shortDescription?: string;
      publishedDate?: string;
    };
  const safePublishedDate: Date | undefined = publishedDate ? new Date(publishedDate) : undefined;

  return (
    <div
      className={cn(
        `flex flex-col overflow-hidden rounded-2xl border bg-white shadow-lg`,
        isReversedLayout ? "lg:flex-row-reverse" : "lg:flex-row",
      )}
    >
      <div className="flex-1 basis-1/2" {...inspectorProps({ fieldId: "featuredImage" })}>
        {article.featuredImage && (
          <CtfImage
            nextImageProps={{
              className: "w-full h-full object-cover",
              priority: true,
              sizes: undefined,
            }}
            {...article.featuredImage}
          />
        )}
      </div>

      <div className="relative flex flex-1 basis-1/2 flex-col justify-center px-4 py-6 lg:px-16 lg:py-12 xl:px-24">
        {isFeatured && (
          <div className="mb-6 flex justify-start">
            <ArticleLabel>{t("article.featured")}</ArticleLabel>
          </div>
        )}

        <div className={cn("text-gray-600")} {...inspectorProps({ fieldId: "publishedDate" })}>
          <FormatDate date={safePublishedDate} />
        </div>
        <h1
          className="mt-3 text-2xl font-semibold md:text-3xl lg:text-4xl"
          {...inspectorProps({ fieldId: "title" })}
        >
          {title}
        </h1>
        {shortDescription && (
          <p className="mt-3" {...inspectorProps({ fieldId: "shortDescription" })}>
            {shortDescription}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center">
          <ArticleAuthor article={article} />
        </div>
      </div>
    </div>
  );
};
