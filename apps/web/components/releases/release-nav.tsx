import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Neighbor {
  slug: string;
  title: string;
}

interface ReleaseNavProps {
  locale: string;
  /** The chronologically older note (rendered on the left). */
  previous?: Neighbor | null;
  /** The chronologically newer note (rendered on the right). */
  next?: Neighbor | null;
  previousLabel: string;
  nextLabel: string;
}

/**
 * Previous/next release links at the foot of a /releases/[slug] page (OJD-1394). A changelog reads
 * chronologically, so this replaces the blog's "related posts" grid: left = older, right = newer.
 */
export function ReleaseNav({ locale, previous, next, previousLabel, nextLabel }: ReleaseNavProps) {
  if (!previous && !next) return null;

  return (
    <nav className="border-border mt-14 grid gap-4 border-t pt-8 sm:grid-cols-2">
      {previous ? (
        <Link
          href={`/${locale}/releases/${previous.slug}`}
          className="border-border hover:border-primary/40 bg-muted/30 group flex flex-col gap-1.5 rounded-xl border p-4 transition-colors"
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
            <ArrowLeft className="size-3.5" />
            {previousLabel}
          </span>
          <span className="text-foreground group-hover:text-primary font-medium transition-colors">
            {previous.title}
          </span>
        </Link>
      ) : (
        <span className="hidden sm:block" />
      )}

      {next && (
        <Link
          href={`/${locale}/releases/${next.slug}`}
          className="border-border hover:border-primary/40 bg-muted/30 group flex flex-col gap-1.5 rounded-xl border p-4 text-right transition-colors sm:col-start-2"
        >
          <span className="text-muted-foreground inline-flex items-center justify-end gap-1.5 font-mono text-[11px] uppercase tracking-wider">
            {nextLabel}
            <ArrowRight className="size-3.5" />
          </span>
          <span className="text-foreground group-hover:text-primary font-medium transition-colors">
            {next.title}
          </span>
        </Link>
      )}
    </nav>
  );
}
