"use client";

import {
  useContentfulInspectorMode,
  useContentfulLiveUpdates,
} from "@contentful/live-preview/react";
import Link from "next/link";
import type { HTMLProps } from "react";

import { cn } from "@repo/ui/lib/utils";

import type { PageBlogPostFieldsFragment } from "../../lib/__generated/sdk";
import { FormatDate } from "../../shared/format-date";
import { CtfImage } from "../contentful";
import { ArticleAuthor } from "./article-author";

interface ArticleTileProps extends HTMLProps<HTMLDivElement> {
  article: PageBlogPostFieldsFragment;
  locale: string;
}

export const ArticleTile = ({ article, className, locale }: ArticleTileProps) => {
  const { featuredImage, publishedDate, slug, title } = useContentfulLiveUpdates(article) as {
    featuredImage?: PageBlogPostFieldsFragment["featuredImage"];
    publishedDate?: string;
    slug?: string;
    title?: string;
  };
  const safePublishedDate: Date | undefined = publishedDate ? new Date(publishedDate) : undefined;
  const inspectorProps = useContentfulInspectorMode({
    entryId: article.sys.id,
  });

  return (
    <Link className="flex flex-col" href={`/${locale}/blog/${slug}`}>
      <div
        className={cn(
          "border-gray300 flex flex-1 flex-col overflow-hidden rounded-2xl border shadow-lg",
          className,
        )}
      >
        {featuredImage && (
          <div {...inspectorProps({ fieldId: "featuredImage" })}>
            <CtfImage
              nextImageProps={{
                className: "object-cover aspect-[16/10] w-full",
              }}
              {...featuredImage}
            />
          </div>
        )}
        <div className="flex flex-1 flex-col px-4 py-3 md:px-5 md:py-4 lg:px-7 lg:py-5">
          {title && (
            <p
              className="h3 text-gray800 mb-2 text-lg font-medium md:mb-3 md:text-xl"
              {...inspectorProps({ fieldId: "title" })}
            >
              {title}
            </p>
          )}

          <div className="mt-auto flex items-center">
            <ArticleAuthor article={article} />
            <div
              className={cn("text-gray600 ml-auto pl-2 text-xs")}
              {...inspectorProps({ fieldId: "publishedDate" })}
            >
              <FormatDate date={safePublishedDate} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
