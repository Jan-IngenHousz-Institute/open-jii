"use client";

import { useCurrentLocale } from "@repo/i18n";
import i18nConfig from "@repo/i18n/config";

interface FormatDateProps {
  date: number | Date | undefined;
  locale?: string;
}

export const formatDateFunc = ({ date, locale }: FormatDateProps) => {
  if (!locale || !date) return null;

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
  }).format(new Date(date));
};

export const FormatDate = (props: FormatDateProps) => {
  const locale = useCurrentLocale(i18nConfig);

  if (!locale) return null;

  return <>{formatDateFunc({ ...props, locale })}</>;
};
