import * as React from "react";

import { cn } from "../lib/utils";

export type InputProps = React.ComponentProps<"input"> & {
  trim?: boolean;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, trim, onBlur, ...props }, ref) => {
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (trim) {
        const value = e.target.value.trim();
        if (e.target.value !== value) {
          e.target.value = value;
          if (props.onChange) {
            // Create a synthetic event with the trimmed value
            const event = {
              ...e,
              target: { ...e.target, value },
            };
            props.onChange(event);
          }
        }
      }
      if (onBlur) {
        onBlur(e);
      }
    };

    return (
      <input
        type={type}
        className={cn(
          "border-input shadow-xs selection:bg-primary selection:text-primary-foreground file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40 flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base outline-none transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        onBlur={trim ? handleBlur : onBlur}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
