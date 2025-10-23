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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <Link href={seeAllHref} locale={locale}>
          <Button variant="ghost" className="text-jii-dark-green text-base font-semibold">
            {seeAllLabel}
          </Button>
        </Link>
      </div>
      {children}
    </div>
  );
}
