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
        <h2 className="text-foreground text-[1rem] font-bold leading-[1.3125rem]">{title}</h2>
        <Link href={seeAllHref} locale={locale} className="hidden md:block">
          <span className="text-primary hover:text-primary/80 text-[1rem] font-semibold leading-[1.25rem]">
            {seeAllLabel}
          </span>
        </Link>
      </div>
      <div className="flex-1">{children}</div>
      <Link
        href={seeAllHref}
        locale={locale}
        className="bg-muted text-foreground hover:bg-accent hover:text-accent-foreground mt-6 flex w-full items-center justify-center rounded-lg py-3 text-sm font-semibold transition-colors md:hidden"
      >
        {seeAllLabel}
      </Link>
    </div>
  );
}
