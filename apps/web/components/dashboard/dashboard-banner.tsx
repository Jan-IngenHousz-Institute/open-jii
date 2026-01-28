import Link from "next/link";

import { Button } from "@repo/ui/components";

interface DashboardBannerProps {
  title: string;
  description: string;
  buttonLabel?: string;
  buttonHref?: string;
  secondaryButtonLabel?: string;
  secondaryButtonHref?: string;
  locale: string;
}

export function DashboardBanner({
  title,
  description,
  buttonLabel,
  buttonHref,
  secondaryButtonLabel,
  secondaryButtonHref,
  locale,
}: DashboardBannerProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-gradient-to-l from-[#F5FFF8] to-[#F4F9FF] p-4 sm:flex-row sm:items-start">
      <div className="flex flex-1 flex-col gap-1">
        <h2 className="text-[0.9125rem] font-semibold leading-[1.3125rem] text-[#011111]">
          {title}
        </h2>
        <p className="text-[0.8125rem] font-normal leading-[1.3125rem] text-[#68737B]">
          {description}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        {secondaryButtonLabel && secondaryButtonHref && (
          <Link
            href={secondaryButtonHref}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto"
          >
            <Button className="bg-highlight hover:bg-highlight-light active:bg-highlight-dark text-muted-dark h-11 w-full whitespace-nowrap rounded-lg px-4 text-[0.9375rem] font-semibold leading-[1.25rem] shadow-none sm:w-auto">
              {secondaryButtonLabel}
            </Button>
          </Link>
        )}
        {buttonLabel && buttonHref && (
          <Link href={buttonHref} locale={locale} className="w-full sm:w-auto">
            <Button className="h-11 w-full whitespace-nowrap rounded-lg px-4 text-[0.9375rem] font-semibold leading-[1.25rem] shadow-none sm:w-auto">
              {buttonLabel}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
