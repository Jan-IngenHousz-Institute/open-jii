"use client";

import React from "react";
import type { ReactElement } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@repo/ui/components";
import { useTranslation } from "@repo/i18n/client";

interface BreadcrumbsProps {
  pathname: string;
  pageTitle?: string;
}

function getUppercaseTitle(title: string) {
  switch (title) {
    case "openjii":
      return "openJII";
    default:
      return title[0].toUpperCase() + title.slice(1);
  }
}

function getTitle(title: string, overrideTitle?: string, t?: (key: string) => string) {
  if (overrideTitle) return overrideTitle;
  
  // Use translations for known breadcrumb items
  if (t) {
    switch (title) {
      case "openjii":
        return "openJII";
      case "experiments":
        return t("breadcrumbs.experiments");
      case "new":
        return t("breadcrumbs.new");
      case "edit":
        return t("breadcrumbs.edit");
      case "view":
        return t("breadcrumbs.view");
      default:
        return title[0].toUpperCase() + title.slice(1);
    }
  }
  
  return getUppercaseTitle(title);
}

export function Breadcrumbs({ pathname, pageTitle }: BreadcrumbsProps) {
  const { t } = useTranslation(undefined, "navigation");
  const pathNames = pathname.split("/").filter((path) => path);
  const breadcrumbItems: ReactElement[] = [];
  pathNames.forEach((link, index) => {
    const href = `/${pathNames.slice(0, index + 1).join("/")}`;
    const title = getTitle(
      link,
      index == pathNames.length - 1 ? pageTitle : undefined,
      t,
    );
    breadcrumbItems.push(
      <React.Fragment key={href}>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href={href}>{title}</BreadcrumbLink>
        </BreadcrumbItem>
      </React.Fragment>,
    );
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/openjii">{t("breadcrumbs.home")}</BreadcrumbLink>
        </BreadcrumbItem>
        {breadcrumbItems}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
