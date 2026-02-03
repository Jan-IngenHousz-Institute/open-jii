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
    <div className={cn("grid gap-6 md:grid-cols-2 lg:grid-cols-3", className)} {...props}>
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
