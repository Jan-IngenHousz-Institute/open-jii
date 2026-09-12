import { cn } from "@repo/ui/lib/utils";

/**
 * Cancels the shell's padding and puts it back inside. Mirrors
 * `app/[locale]/platform/layout.tsx` by hand and must stay in step with it.
 */
export const workspaceBleed =
  "3xl:-mx-10 3xl:px-10 4xl:-mx-14 4xl:px-14 -mx-4 -mb-4 px-4 pb-4 md:-mx-6 md:-mb-6 md:px-6 md:pb-6";

interface WorkspaceBandProps {
  children: React.ReactNode;
  /** Only for a band that is the first thing on its page. */
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
