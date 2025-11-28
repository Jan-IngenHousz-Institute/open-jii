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
  /** When true, render the horizontal (list) layout; otherwise vertical (grid) */
  horizontal?: boolean;
}

export const ArticleTile = ({
  article,
  className,
  locale,
  horizontal = false,
}: ArticleTileProps) => {
  const { featuredImage, publishedDate, slug, title } = useContentfulLiveUpdates(article) as {
    featuredImage?: PageBlogPostFieldsFragment["featuredImage"];
    publishedDate?: string;
    slug?: string;
    title?: string;
  };

  const safePublishedDate: Date | undefined = publishedDate ? new Date(publishedDate) : undefined;
  const inspectorProps = useContentfulInspectorMode({ entryId: article.sys.id });

  if (horizontal) {
    // --- HORIZONTAL
    return (
      <Link className="flex" href={`/${locale}/blog/${slug}`}>
        <div
          className={cn(
            "border-gray300 flex flex-1 flex-row overflow-hidden rounded-lg border transition-shadow hover:shadow-md",
            className,
          )}
        >
          {featuredImage && (
            <div
              {...inspectorProps({ fieldId: "featuredImage" })}
              className="flex h-full w-2/5 min-w-[100px] max-w-[160px] items-center justify-center md:w-1/3 md:min-w-[120px] md:max-w-[180px]"
            >
              <CtfImage
                nextImageProps={{
                  className: "object-cover w-full h-full",
                }}
                {...featuredImage}
              />
            </div>
          )}

          <div className="flex flex-1 flex-col px-4 py-3 md:px-5 md:py-4">
            <div
              className={cn("mb-2 text-left text-xs text-gray-600 md:text-sm")}
              {...inspectorProps({ fieldId: "publishedDate" })}
            >
              <FormatDate date={safePublishedDate} />
            </div>

            {title && (
              <p
                className="h3 mb-2 text-left text-sm font-medium text-gray-900 md:mb-3 lg:text-base lg:font-semibold"
                {...inspectorProps({ fieldId: "title" })}
              >
                {title}
              </p>
            )}

            <div className="mt-auto flex flex-col items-start gap-2">
              <ArticleAuthor article={article} />
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // --- VERTICAL
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
              className="h3 mb-2 text-lg font-medium text-gray-800 md:mb-3 md:text-xl"
              {...inspectorProps({ fieldId: "title" })}
            >
              {title}
            </p>
          )}

          <div className="mt-auto flex items-center">
            <ArticleAuthor article={article} />
            <div
              className={cn("ml-auto pl-2 text-xs text-gray-600")}
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
