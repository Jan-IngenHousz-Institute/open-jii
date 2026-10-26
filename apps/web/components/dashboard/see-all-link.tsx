import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import type { ReactNode } from "react";

/** For a See all that opens a panel rather than a page. */
export const seeAllClassName =
  "text-primary hover:text-primary/80 shrink-0 text-sm font-semibold transition-colors";

export function SeeAllLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <IntentLink href={href} className={seeAllClassName}>
      {children}
    </IntentLink>
  );
}
