import type { HTMLProps } from "react";

import { cn } from "@repo/ui/lib/utils";

export const Container = ({
  className,
  ...props
}: HTMLProps<HTMLDivElement>) => {
  return <div className={cn("max-w-8xl mx-auto px-4", className)} {...props} />;
};
