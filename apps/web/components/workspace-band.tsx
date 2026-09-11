import { cn } from "@repo/ui/lib/utils";

/**
 * The negative margins that cancel the platform shell's padding, plus the
 * padding put back on the inside so content keeps its gutter.
 *
 * This mirrors `app/[locale]/platform/layout.tsx`'s `px-4 py-4 md:px-6 md:py-6
 * 3xl:px-10 4xl:px-14` by hand, and has to stay in step with it: a band that
 * pulls further than the shell pads overflows the viewport, and one that pulls
 * less leaves a gutter of page showing beside a surface meant to be full-bleed.
 * Exported because three pages draw this band and each had re-derived the
 * string, two of them with a flat `-mx-6`/`-mb-6` that over-pulls by 8px below
 * `md`.
 */
export const workspaceBleed =
  "3xl:-mx-10 3xl:px-10 4xl:-mx-14 4xl:px-14 -mx-4 -mb-4 px-4 pb-4 md:-mx-6 md:-mb-6 md:px-6 md:pb-6";

interface WorkspaceBandProps {
  children: React.ReactNode;
  /**
   * Pull the band up under the shell header. Only for a page where the band is
   * the first thing on it; anywhere else this eats the content above.
   */
  flush?: boolean;
  className?: string;
}

/**
 * The platform's workspace surface, as the analysis pages define it: a
 * full-bleed tinted band that owns the rest of the viewport, with the page's
 * working content floating on it as cards.
 */
export function WorkspaceBand({ children, flush = false, className }: WorkspaceBandProps) {
  return (
    <div
      className={cn(
        "bg-canvas border-border flex min-w-0 flex-1 flex-col border-t",
        workspaceBleed,
        flush && "-mt-4 md:-mt-6",
        className,
      )}
    >
      <div className="flex w-full min-w-0 flex-1 flex-col pt-6">{children}</div>
    </div>
  );
}
