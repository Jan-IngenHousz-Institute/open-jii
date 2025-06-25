import type { HTMLProps, ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

interface ArticleLabelProps extends HTMLProps<HTMLSpanElement> {
  children: ReactNode;
}

export const ArticleLabel = ({
  children,
  className,
  ...props
}: ArticleLabelProps) => {
  return (
    <span
      className={cn(
        "rounded bg-purple-100 px-2 py-1 text-xs font-medium uppercase leading-none tracking-widest text-purple-700",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};
