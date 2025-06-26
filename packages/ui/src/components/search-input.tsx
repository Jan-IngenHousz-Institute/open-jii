"use client";

import { Search, Loader2, X } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Button } from "./button";
import { Input, type InputProps } from "./input";

export interface SearchInputProps extends Omit<InputProps, "onChange" | "onSubmit"> {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  isLoading?: boolean;
  clearable?: boolean;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onSearch,
      isLoading = false,
      clearable = true,
      className,
      inputClassName,
      placeholder = "Search...",
      ...props
    },
    ref,
  ) => {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (onSearch) {
        onSearch(value);
      }
    };

    return (
      <form onSubmit={handleSubmit} className={cn("relative w-full", className)}>
        <Search className="text-muted-foreground absolute left-2 top-2.5 h-4 w-4" />
        <Input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("pl-8 pr-8", inputClassName)}
          placeholder={placeholder}
          {...props}
        />
        {isLoading ? (
          <Loader2 className="text-muted-foreground absolute right-2 top-2.5 h-4 w-4 animate-spin" />
        ) : (
          clearable &&
          value.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground absolute right-0 top-0 h-full rounded-l-none p-1"
              onClick={() => onChange("")}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear</span>
            </Button>
          )
        )}
      </form>
    );
  },
);

SearchInput.displayName = "SearchInput";
