import { IntentLink } from "@/components/navigation/intent-link/intent-link";

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
        <IntentLink href={seeAllHref} locale={locale} className="hidden md:block">
          <span className="text-primary hover:text-primary/80 text-[1rem] font-semibold leading-[1.25rem]">
            {seeAllLabel}
          </span>
        </IntentLink>
      </div>
      <div className="flex-1">{children}</div>
      <IntentLink
        href={seeAllHref}
        locale={locale}
        className="bg-muted text-foreground hover:bg-accent hover:text-accent-foreground mt-6 flex w-full items-center justify-center rounded-lg py-3 text-sm font-semibold transition-colors md:hidden"
      >
        {seeAllLabel}
      </IntentLink>
    </div>
  );
}
