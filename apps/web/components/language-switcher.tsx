"use client";

import { Languages } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Locale } from "@repo/i18n";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components";

const locales = [
  { code: "en-US" as const, name: "English", flag: "🇺🇸" },
  { code: "de-DE" as const, name: "Deutsch", flag: "🇩🇪" },
  { code: "nl-NL" as const, name: "Nederlands", flag: "🇳🇱" },
];

interface LanguageSwitcherProps {
  locale: Locale;
}

export function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  const pathname = usePathname();
  const currentLocale = locales.find((l) => l.code === locale) ?? locales[0];

  // Generate language switch URL
  const getLanguageSwitchUrl = (newLocale: Locale) => {
    // Remove current locale from pathname if present
    const pathWithoutLocale = pathname.replace(`/${locale}`, "") || "/";

    // Construct new path with new locale
    return `/${newLocale}${pathWithoutLocale}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" aria-label="Switch language">
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">{currentLocale.flag}</span>
          <span className="hidden md:inline">{currentLocale.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem key={loc.code} asChild>
            <Link
              href={getLanguageSwitchUrl(loc.code)}
              className={`w-full cursor-pointer ${loc.code === locale ? "bg-accent" : ""}`}
            >
              <span className="mr-2">{loc.flag}</span>
              {loc.name}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
