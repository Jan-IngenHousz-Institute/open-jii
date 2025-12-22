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
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-[1rem] font-bold leading-[1.3125rem] text-[#011111]">{title}</h2>
        <Link href={seeAllHref} locale={locale} className="hidden md:block">
          <span className="text-[1rem] font-semibold leading-[1.25rem] text-[#005E5E] hover:text-[#004a4a]">
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
