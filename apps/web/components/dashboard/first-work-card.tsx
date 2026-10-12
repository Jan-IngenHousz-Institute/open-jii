import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import type { LucideIcon } from "lucide-react";

import { Card } from "@repo/ui/components/card";

interface FirstWorkCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

/** One starting point for a researcher with no experiments yet. */
export function FirstWorkCard({ href, icon: Icon, title, description }: FirstWorkCardProps) {
  return (
    <IntentLink href={href}>
      <Card interactive className="flex h-full flex-row items-start gap-4 p-5">
        <Icon aria-hidden="true" className="text-primary mt-0.5 size-6 shrink-0" />
        <div>
          <h3 className="text-foreground mb-1.5 text-base font-semibold tracking-tight md:text-lg">
            {title}
          </h3>
          <p className="text-muted-foreground text-[13px] leading-relaxed">{description}</p>
        </div>
      </Card>
    </IntentLink>
  );
}
