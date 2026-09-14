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
  // Teal, not brand gold, which reads 1.1:1 on --card. An absolute bar rather
  // than `border-l-4`, because a border arc tapers a 4px rule around the radius
  // into the 1px hairlines. Workbook cells draw it the same way.
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
      {/* Wrapping, not a breakpoint: the labels are nowrap and translated, so
          what fits is a property of the text, not of the viewport. */}
      <div className="flex w-full flex-row flex-wrap gap-2 lg:w-auto lg:flex-nowrap lg:gap-4">
        {secondaryButtonLabel && secondaryButtonHref && (
          <Link
            href={secondaryButtonHref}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-[9rem] flex-1 lg:w-auto lg:min-w-0 lg:flex-none"
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
            className="min-w-[9rem] flex-1 lg:w-auto lg:min-w-0 lg:flex-none"
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
