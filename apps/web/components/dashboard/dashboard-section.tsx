import Link from "next/link";

import { Button } from "@repo/ui/components";

interface DashboardSectionProps {
  title: string;
  seeAllLabel: string;
  seeAllHref: string;
  locale: string;
  children: React.ReactNode;
}

export function DashboardSection({
  title,
  seeAllLabel,
  seeAllHref,
  locale,
  children,
}: DashboardSectionProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <Link href={seeAllHref} locale={locale}>
          <span className="text-primary hover:text-primary/80 text-sm font-semibold">
            {seeAllLabel}
          </span>
        </Link>
      </div>
      {children}
    </div>
  );
}
