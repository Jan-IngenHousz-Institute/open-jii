import type { userNavigation } from "@/components/navigation/navigation-config";
import Link from "next/link";

import { useTranslation } from "@repo/i18n";

interface NavigationMobileNavItemProps {
  item: (typeof userNavigation)[keyof typeof userNavigation];
  locale: string;
  onItemClick: () => void;
}

export function NavigationMobileNavItem({
  item,
  locale,
  onItemClick,
}: NavigationMobileNavItemProps) {
  const { t } = useTranslation();

  const linkProps = {
    onClick: onItemClick,
    className: "mx-4 flex w-full items-center rounded-lg py-3 text-white/80 transition-colors",
  };

  const content = <span className="font-medium">{t(item.titleKey, { ns: item.namespace })}</span>;

  const isExternal = "external" in item && item.external;

  if (isExternal) {
    return (
      <a {...linkProps} href={item.url(locale)} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return (
    <Link {...linkProps} href={item.url(locale)}>
      {content}
    </Link>
  );
}
