import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import Image from "next/image";

import type { PageBlogPostFieldsFragment } from "@repo/cms/lib/__generated/sdk";

interface BlogPostTileProps {
  post: PageBlogPostFieldsFragment;
  locale: string;
}

/** A post as its picture with the date and title over it, three to a row. */
export function BlogPostTile({ post, locale }: BlogPostTileProps) {
  const image = post.featuredImage;
  // The day as the editor entered it: its offset could move the moment to another day in UTC.
  const published =
    typeof post.publishedDate === "string"
      ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
          new Date(`${post.publishedDate.slice(0, 10)}T00:00:00Z`),
        )
      : null;

  return (
    <IntentLink
      href={`/${locale}/blog/${post.slug}`}
      className="bg-muted group relative block aspect-[16/10] overflow-hidden rounded-lg"
    >
      {image?.url ? (
        <Image
          src={image.url}
          alt={image.title ?? ""}
          fill
          // One tile spans the column only while the column is narrow; three share it otherwise.
          sizes="(max-width: 800px) 100vw, 320px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : null}
      {/* Brand chrome stays dark in both themes, so the text reads over any photo. */}
      <div
        aria-hidden
        className="from-brand-chrome/90 via-brand-chrome/35 absolute inset-0 bg-gradient-to-t to-transparent"
      />
      <div className="text-brand-chrome-foreground absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3">
        {published ? (
          <span className="text-brand-chrome-foreground/80 text-xs">{published}</span>
        ) : null}
        <span className="line-clamp-2 text-sm font-semibold leading-snug">{post.title}</span>
      </div>
    </IntentLink>
  );
}
