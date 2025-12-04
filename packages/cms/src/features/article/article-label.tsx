import type { HTMLProps, ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";

interface ArticleLabelProps extends HTMLProps<HTMLSpanElement> {
  children: ReactNode;
}

export const ArticleLabel = ({ children, className, ...props }: ArticleLabelProps) => {
  return (
    <span
      className={cn(
        "bg-badge-featured text-primary rounded px-2 py-1 text-xs font-medium uppercase leading-none tracking-widest",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};
