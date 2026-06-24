import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@repo/ui/lib/utils";

type ArticleMediaCaptionProps = ComponentPropsWithoutRef<"figcaption">;

export const ArticleMediaCaption = ({
  children,
  className,
  ...props
}: ArticleMediaCaptionProps) => (
  <figcaption {...props} className={cn("-mt-1 text-sm italic text-gray-500", className)}>
    {children}
  </figcaption>
);
