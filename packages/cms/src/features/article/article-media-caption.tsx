import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@repo/ui/lib/utils";

type ArticleMediaCaptionProps = ComponentPropsWithoutRef<"figcaption">;

export const ArticleMediaCaption = ({
  children,
  className,
  ...props
}: ArticleMediaCaptionProps) => (
  <figcaption
    {...props}
    className={cn("text-muted-foreground -mt-1 text-center text-sm italic", className)}
  >
    {children}
  </figcaption>
);
