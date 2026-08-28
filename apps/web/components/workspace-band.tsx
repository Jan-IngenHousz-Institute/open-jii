import { cn } from "@repo/ui/lib/utils";

interface WorkspaceBandProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * The platform's workspace surface, as the analysis pages define it: a
 * full-bleed tinted band that owns the rest of the viewport, with the page's
 * working content floating on it as cards. The negative margins mirror the
 * platform shell's responsive padding so the band truly reaches the edges.
 */
export function WorkspaceBand({ children, className }: WorkspaceBandProps) {
  return (
    <div
      className={cn(
        "3xl:-mx-10 4xl:-mx-14 3xl:px-10 4xl:px-14 bg-canvas border-border -mx-4 -mb-6 flex flex-1 flex-col border-t px-4 pb-6 md:-mx-6 md:px-6",
        className,
      )}
    >
      <div className="flex w-full flex-1 flex-col pt-6">{children}</div>
    </div>
  );
}
