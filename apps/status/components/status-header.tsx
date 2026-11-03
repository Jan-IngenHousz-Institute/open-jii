"use client";

import Image from "next/image";

import { useTranslation } from "@repo/i18n/client";
import { ThemeToggle } from "@repo/ui/components/theme";

// The yellow logo needs the dark brand chrome behind it in both themes.
const CHROME_ICON_BUTTON =
  "hover:text-brand-accent hover:bg-transparent focus:bg-transparent dark:hover:bg-transparent focus-visible:border-brand-accent focus-visible:ring-brand-accent/50";

export function StatusHeader() {
  const { t } = useTranslation("status");

  return (
    <header className="bg-brand-chrome text-brand-chrome-foreground border-brand-chrome-border border-b">
      <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4 md:px-8">
        <a
          href="https://openjii.org"
          className="focus-visible:outline-brand-accent rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <Image
            src="/openJII_logo_RGB_horizontal_yellow_transparentBG.png"
            alt={t("header.home")}
            width={1955}
            height={573}
            priority
            className="h-10 w-auto max-w-none shrink-0"
          />
        </a>
        <ThemeToggle
          className={CHROME_ICON_BUTTON}
          labels={{
            toggle: t("theme.toggle"),
            switchToLight: t("theme.switchToLight"),
            switchToDark: t("theme.switchToDark"),
          }}
        />
      </div>
    </header>
  );
}
