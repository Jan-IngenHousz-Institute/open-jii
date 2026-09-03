import { cn } from "@repo/ui/lib/utils";

export function sidebarUtilityRow(className?: string) {
  return cn(
    "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring flex h-9 w-full items-center justify-start gap-2 rounded-lg px-2 py-0 text-sm font-normal transition-colors focus-visible:outline-none focus-visible:ring-2",
    className,
  );
}
