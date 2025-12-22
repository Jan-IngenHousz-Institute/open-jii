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

  const safePublishedDate = publishedDate ? new Date(publishedDate) : undefined;
  const inspectorProps = useContentfulInspectorMode({ entryId: article.sys.id });

  // HORIZONTAL
  if (horizontal) {
    return (
      <Link href={`/${locale}/blog/${slug}`} className={cn("flex flex-col", className)}>
        <article className="relative isolate flex h-full min-h-[180px] flex-col overflow-hidden rounded-2xl bg-gray-900">
          {/* IMAGE */}
          {featuredImage && (
            <div {...inspectorProps({ fieldId: "featuredImage" })}>
              <CtfImage
                nextImageProps={{
                  className:
                    "absolute inset-0 -z-10 h-full w-full object-cover pointer-events-none",
                }}
                {...featuredImage}
              />
            </div>
          )}

          {/* GRADIENTS */}
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-gray-900 via-gray-900/40" />
          <div className="inset-ring inset-ring-gray-900/10 pointer-events-none absolute inset-0 -z-10 rounded-2xl" />

          {/* CONTENT */}
          <div className="relative z-10 mt-auto px-6 pb-6">
            <div className="flex flex-wrap items-center gap-y-1 overflow-hidden text-sm text-gray-300">
              {/* AUTHOR */}
              <div className="mr-8">
                <ArticleAuthor article={article} noAvatar />
              </div>

              <div className="-ml-4 flex items-center gap-x-4">
                <svg viewBox="0 0 2 2" className="-ml-0.5 h-0.5 w-0.5 flex-none fill-white/50">
                  <circle r="1" cx="1" cy="1" />
                </svg>

                <time {...inspectorProps({ fieldId: "publishedDate" })}>
                  <FormatDate date={safePublishedDate} />
                </time>
              </div>
            </div>

            {title && (
              <h3
                className="mt-1 text-lg font-semibold leading-6 text-white"
                {...inspectorProps({ fieldId: "title" })}
              >
                {title}
              </h3>
            )}
          </div>
        </article>
      </Link>
    );
  }

  // VERTICAL
  return (
    <Link href={`/${locale}/blog/${slug}`} className={cn("flex flex-col", className)}>
      <article className="relative isolate flex h-[420px] flex-col overflow-hidden rounded-2xl bg-gray-900">
        {/* IMAGE */}
        {featuredImage && (
          <div {...inspectorProps({ fieldId: "featuredImage" })}>
            <CtfImage
              nextImageProps={{
                className: "absolute inset-0 -z-10 h-full w-full object-cover pointer-events-none",
              }}
              {...featuredImage}
            />
          </div>
        )}

        {/* GRADIENTS */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-gray-900 via-gray-900/40" />
        <div className="inset-ring inset-ring-gray-900/10 pointer-events-none absolute inset-0 -z-10 rounded-2xl" />

        {/* CONTENT */}
        <div className="relative z-10 mt-auto px-8 pb-8 text-gray-300">
          {/* DATE */}
          <time className="text-sm" {...inspectorProps({ fieldId: "publishedDate" })}>
            <FormatDate date={safePublishedDate} />
          </time>

          {/* TITLE */}
          {title && (
            <h3
              className="mt-1 text-xl font-semibold leading-6 text-white"
              {...inspectorProps({ fieldId: "title" })}
            >
              {title}
            </h3>
          )}

          {/* AUTHOR */}
          <div className="mt-3">
            <ArticleAuthor article={article} isTile />
          </div>
        </div>
      </article>
    </Link>
  );
};
