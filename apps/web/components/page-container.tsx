import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@repo/ui/lib/utils";

export type PageContainerWidth = "fluid" | "wide" | "reading";

interface PageContainerProps extends ComponentPropsWithoutRef<"div"> {
  width?: PageContainerWidth;
}

export function PageContainer({
  width = "wide",
  className,
  children,
  ...rest
}: PageContainerProps) {
  return (
    <div className={cn(widthClass[width], className)} {...rest}>
      {children}
    </div>
  );
}

// `wide` caps content at max-w-7xl on small screens and widens at 3xl/4xl.
// When a descendant renders `<PageContainer width="fluid">`, the `has-[.page-fluid]`
// rules release the cap so the table/canvas can fill the viewport without each route
// needing to know about the parent wrapper.
const widthClass: Record<PageContainerWidth, string> = {
  fluid: "page-fluid flex flex-1 flex-col",
  wide: "3xl:max-w-[1680px] 4xl:max-w-[2200px] mx-auto w-full max-w-7xl has-[.page-fluid]:flex has-[.page-fluid]:max-w-none has-[.page-fluid]:flex-1 has-[.page-fluid]:flex-col",
  reading: "page-reading mx-auto w-full max-w-3xl",
};
