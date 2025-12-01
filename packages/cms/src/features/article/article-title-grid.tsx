import type { HTMLProps } from "react";

import { cn } from "@repo/ui/lib/utils";

import type { PageBlogPostFieldsFragment } from "../../lib/__generated/sdk";
import { ArticleTile } from "./article-title";

interface ArticleTileGridProps extends HTMLProps<HTMLDivElement> {
  articles?: (PageBlogPostFieldsFragment | null)[];
  locale: string;
  horizontal?: boolean;
}

export const ArticleTileGrid = ({
  articles,
  className,
  locale,
  horizontal = false,
  ...props
}: ArticleTileGridProps) => {
  return articles && articles.length > 0 ? (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-3 lg:gap-x-12 lg:gap-y-12",
        className,
      )}
      {...props}
    >
      {articles.map((article) =>
        article ? (
          <ArticleTile
            key={article.sys.id}
            article={article}
            locale={locale}
            horizontal={horizontal}
          />
        ) : null,
      )}
    </div>
  ) : null;
};
