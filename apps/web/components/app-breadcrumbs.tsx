import React from "react";
import type { ReactElement } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@repo/ui";

interface BreadcrumbsProps {
  pathname: string;
}

export function Breadcrumbs({ pathname }: BreadcrumbsProps) {
  const pathNames = pathname.split("/").filter((path) => path);
  const breadcrumbItems: ReactElement[] = [];
  pathNames.forEach((link, index) => {
    const href = `/${pathNames.slice(0, index + 1).join("/")}`;
    const itemLink = link[0].toUpperCase() + link.slice(1);
    breadcrumbItems.push(
      <React.Fragment key={href}>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href={href}>{itemLink}</BreadcrumbLink>
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
