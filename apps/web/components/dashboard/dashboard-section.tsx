import Link from "next/link";

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
    <div className="flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <Link href={seeAllHref} locale={locale} className="hidden md:block">
          <span className="text-primary hover:text-primary/80 text-sm font-semibold">
            {seeAllLabel}
          </span>
        </Link>
      </div>
      <div className="flex-1">{children}</div>
      <Link
        href={seeAllHref}
        locale={locale}
        className="mt-6 flex w-full items-center justify-center rounded-lg bg-gray-100 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-200 md:hidden"
      >
        {seeAllLabel}
      </Link>
    </div>
  );
}
