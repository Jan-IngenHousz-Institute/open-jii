import Link from "next/link";

import { Button } from "@repo/ui/components/button";

interface DashboardBannerProps {
  title: string;
  description: string;
  descriptionItalic?: string;
  descriptionItalicHref?: string;
  buttonLabel?: string;
  buttonHref?: string;
  secondaryButtonLabel?: string;
  secondaryButtonHref?: string;
  locale: string;
}

export function DashboardBanner({
  title,
  description,
  descriptionItalic,
  descriptionItalicHref,
  buttonLabel,
  buttonHref,
  secondaryButtonLabel,
  secondaryButtonHref,
  locale,
}: DashboardBannerProps) {
  // Both buttons are nowrap and need ~20rem together. Beside an open sidebar
  // that only fits from lg up; at sm the copy was crushed to a few words per line.
  //
  // The left rule is teal rather than brand gold: --brand-accent is a chrome
  // colour and reads at 1.1:1 on --card. It is an absolute bar rather than a
  // `border-l-4` because a border arc interpolates between the two adjacent
  // widths, tapering a 4px rule around the radius into the 1px hairlines.
  // Workbook cells draw it the same way.
  return (
    <div className="bg-card relative flex flex-col gap-3 overflow-hidden rounded-xl border p-4 pl-6 shadow-sm lg:flex-row lg:items-start">
      <div className="bg-primary absolute left-0 top-0 h-full w-1" aria-hidden />
      <div className="flex flex-1 flex-col gap-1">
        <h2 className="text-foreground text-[0.9125rem] font-semibold leading-[1.3125rem]">
          {title}
        </h2>
        <p className="text-muted-foreground text-[0.8125rem] font-normal leading-[1.3125rem]">
          {description}
          {descriptionItalic && descriptionItalicHref && (
            <Link
              href={descriptionItalicHref}
              target="_blank"
              rel="noopener noreferrer"
              className="italic hover:underline"
            >
              {descriptionItalic}
            </Link>
          )}
        </p>
      </div>
      {/* Side by side once there is room for both labels, which is ~26rem;
          stacked below that. Not an `sm:` breakpoint: the two buttons are
          nowrap and do not both fit at 640px beside an open sidebar, which is
          what dashboard-banner.test.tsx pins. */}
      <div className="min-[26rem]:flex-row min-[26rem]:gap-3 flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:gap-4">
        {secondaryButtonLabel && secondaryButtonHref && (
          <Link
            href={secondaryButtonHref}
            target="_blank"
            rel="noopener noreferrer"
            className="min-[26rem]:flex-1 w-full lg:w-auto lg:flex-none"
          >
            <Button
              variant="secondary"
              className="h-10 w-full whitespace-nowrap rounded-lg px-4 text-[0.9375rem] font-semibold leading-[1.25rem] shadow-none lg:h-11 lg:w-auto"
            >
              {secondaryButtonLabel}
            </Button>
          </Link>
        )}
        {buttonLabel && buttonHref && (
          <Link
            href={buttonHref}
            locale={locale}
            className="min-[26rem]:flex-1 w-full lg:w-auto lg:flex-none"
          >
            <Button className="h-10 w-full whitespace-nowrap rounded-lg px-4 text-[0.9375rem] font-semibold leading-[1.25rem] shadow-none lg:h-11 lg:w-auto">
              {buttonLabel}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
