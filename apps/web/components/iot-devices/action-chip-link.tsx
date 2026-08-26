import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface ActionChipLinkProps {
  href: string;
  children: ReactNode;
}

/** The next-action chip shell: one look for every computed-step deep link. */
export function ActionChipLink({ href, children }: ActionChipLinkProps) {
  return (
    <Link
      href={href}
      className="bg-secondary text-secondary-foreground focus-visible:ring-primary/40 focus-visible:outline-hidden inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium hover:opacity-90 focus-visible:ring-2"
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}
