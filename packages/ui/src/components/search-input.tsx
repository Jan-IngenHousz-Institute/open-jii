"use client";

import { Search, X } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import type { InputProps } from "./input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "./input-group";
import { Spinner } from "./spinner";

export interface SearchInputProps extends Omit<InputProps, "onChange" | "onSubmit"> {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  isLoading?: boolean;
  clearable?: boolean;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  clearLabel?: string;
  loadingLabel?: string;
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
      clearLabel = "Clear",
      loadingLabel = "Loading",
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
      <form onSubmit={handleSubmit} className={cn("w-full", className)}>
        <InputGroup data-disabled={props.disabled || undefined} aria-busy={isLoading || undefined}>
          <InputGroupInput
            {...props}
            ref={ref}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={inputClassName}
            placeholder={placeholder}
            aria-busy={isLoading ? true : props["aria-busy"]}
          />
          <InputGroupAddon align="inline-start">
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end" className="w-8 p-0 has-[>button]:mr-0">
            {isLoading ? (
              <Spinner className="text-muted-foreground" aria-label={loadingLabel} />
            ) : (
              clearable &&
              value.length > 0 && (
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  aria-label={clearLabel}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => onChange("")}
                >
                  <X />
                </InputGroupButton>
              )
            )}
          </InputGroupAddon>
        </InputGroup>
      </form>
    );
  },
);

SearchInput.displayName = "SearchInput";
