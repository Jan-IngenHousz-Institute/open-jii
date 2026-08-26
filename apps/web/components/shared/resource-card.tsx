import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn, cva } from "@repo/ui/lib/utils";

// Layout and the featured tint only — the chrome (background, border, radius,
// shadow) comes from `Card`, and so does the hover lift, via `interactive`.
const resourceCardVariants = cva("relative h-full min-h-[180px] gap-3 p-5", {
  variants: {
    featured: {
      true: "border-secondary/30 from-status-featured to-card bg-gradient-to-br",
      false: "",
    },
  },
  defaultVariants: { featured: false },
});

export interface ResourceCardProps {
  href: string;
  title: ReactNode;
  /** Badges shown above the title. */
  badges?: ReactNode;
  /** The description body — usually a `RichTextRenderer`. */
  children?: ReactNode;
  /** Content between the description and the footer, e.g. a compatibility list. */
  extra?: ReactNode;
  /** The muted line at the bottom, usually a last-updated date. */
  footer?: ReactNode;
  /** Lifts the card onto the featured gradient. */
  featured?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
}

/**
 * One tile in a resource listing — experiment, protocol, macro, organization.
 * The whole tile is the link; the chevron is a mobile-only affordance because
 * hover cannot say "tappable" on a touch screen.
 */
export function ResourceCard({
  href,
  title,
  badges,
  children,
  extra,
  footer,
  featured = false,
  onMouseEnter,
  onMouseLeave,
  className,
}: ResourceCardProps) {
  return (
    <Link href={href} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <Card interactive className={cn(resourceCardVariants({ featured }), className)}>
        {badges ? <div className="inline-flex flex-wrap gap-1">{badges}</div> : null}
        <div className="mb-auto">
          <h3 className="text-foreground mb-2 line-clamp-2 break-words text-base font-semibold md:text-lg">
            {title}
          </h3>
          {children ? (
            <div className="text-muted-foreground overflow-hidden text-sm">{children}</div>
          ) : null}
        </div>
        {extra}
        {footer ? <p className="text-muted-foreground text-xs">{footer}</p> : null}
        <ChevronRight
          className="text-foreground absolute bottom-5 right-5 size-6 md:hidden"
          aria-hidden
        />
      </Card>
    </Link>
  );
}

export interface ResourceCardGridProps {
  /** Renders the three-tile skeleton instead of the children. */
  isLoading?: boolean;
  /** Renders instead of the children when there is nothing to list. */
  isEmpty?: boolean;
  emptyMessage?: ReactNode;
  /** Extra content under the empty message, e.g. a get-started link. */
  emptyExtra?: ReactNode;
  children?: ReactNode;
}

/**
 * The three-across grid every resource listing uses, together with its loading
 * and empty states — the three were duplicated per entity, and drifted.
 */
export function ResourceCardGrid({
  isLoading = false,
  isEmpty = false,
  emptyMessage,
  emptyExtra,
  children,
}: ResourceCardGridProps) {
  if (isLoading) {
    return (
      <div aria-busy="true" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-48" />
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="text-muted-foreground text-sm">
        {emptyMessage}
        {emptyExtra ? <div className="mt-2">{emptyExtra}</div> : null}
      </div>
    );
  }

  return <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
