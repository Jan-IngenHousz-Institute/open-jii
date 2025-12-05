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
        `border-gray300 flex flex-col overflow-hidden rounded-2xl border shadow-lg`,
        isReversedLayout ? "lg:flex-row-reverse" : "lg:flex-row",
      )}
    >
      <div className="flex-1 basis-1/2" {...inspectorProps({ fieldId: "featuredImage" })}>
        {article.featuredImage && (
          <CtfImage
            nextImageProps={{
              className: "w-full h-full",
              priority: true,
              sizes: undefined,
            }}
            {...article.featuredImage}
          />
        )}
      </div>

      <div className="relative flex flex-1 basis-1/2 flex-col justify-center px-4 py-6 lg:px-16 lg:py-12 xl:px-24">
        {isFeatured && (
          <div className="mb-4 flex justify-start">
            <ArticleLabel>{t("article.featured")}</ArticleLabel>
          </div>
        )}

        <div className="mb-2 flex flex-wrap items-center">
          <ArticleAuthor article={article} />
          <div
            className={cn(
              "text-gray600 ml-auto hidden pl-2 text-xs",
              isReversedLayout ? "lg:block" : "",
            )}
            {...inspectorProps({ fieldId: "publishedDate" })}
          >
            <FormatDate date={safePublishedDate} />
          </div>
        </div>
        <h1
          className="text-2xl font-semibold md:text-3xl lg:text-4xl"
          {...inspectorProps({ fieldId: "title" })}
        >
          {title}
        </h1>
        {shortDescription && (
          <p className="mt-2" {...inspectorProps({ fieldId: "shortDescription" })}>
            {shortDescription}
          </p>
        )}
        <div
          className={cn("text-gray600 mt-2 text-xs", isReversedLayout ? "lg:hidden" : "")}
          {...inspectorProps({ fieldId: "publishedDate" })}
        >
          <FormatDate date={safePublishedDate} />
        </div>
      </div>
    </div>
  );
};
