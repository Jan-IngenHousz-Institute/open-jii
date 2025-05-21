import React from "react";
import type { ReactElement } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@repo/ui/components";

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

function getTitle(title: string, overrideTitle?: string) {
  return overrideTitle ?? getUppercaseTitle(title);
}

export function Breadcrumbs({ pathname, pageTitle }: BreadcrumbsProps) {
  const pathNames = pathname.split("/").filter((path) => path);
  const breadcrumbItems: ReactElement[] = [];
  pathNames.forEach((link, index) => {
    const href = `/${pathNames.slice(0, index + 1).join("/")}`;
    const title = getTitle(
      link,
      index == pathNames.length - 1 ? pageTitle : undefined,
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
          <BreadcrumbLink href="/openjii">Home</BreadcrumbLink>
        </BreadcrumbItem>
        {breadcrumbItems}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
