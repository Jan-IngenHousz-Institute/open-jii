import { cx, cva } from "class-variance-authority";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: Parameters<typeof cx>) {
  return twMerge(cx(inputs));
}

export { cva };
export type { VariantProps } from "class-variance-authority";
