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
  return (
    <div className="bg-canvas flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-start">
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
      <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
        {secondaryButtonLabel && secondaryButtonHref && (
          <Link
            href={secondaryButtonHref}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto"
          >
            <Button
              variant="secondary"
              className="h-11 w-full whitespace-nowrap rounded-lg px-4 text-[0.9375rem] font-semibold leading-[1.25rem] shadow-none sm:w-auto"
            >
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
