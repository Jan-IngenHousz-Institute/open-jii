"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";

interface InlineChoiceOption<T extends string> {
  value: T;
  label?: string;
  hint?: string;
}

/** A value inside a sentence that comes from a list the rig or the driver already fixed. */
interface InlineChoiceProps<T extends string> {
  value: string;
  label: string;
  options: InlineChoiceOption<T>[];
  canEdit: boolean;
  onCommit: (value: T) => void;
  mono?: boolean;
  placeholder?: string;
}

export function InlineChoice<T extends string>({
  value,
  label,
  options,
  canEdit,
  onCommit,
  mono = true,
  placeholder,
}: InlineChoiceProps<T>) {
  // Two instruments can briefly share a role while it is being renamed; one entry per value
  // keeps the list, and the value shown, from doubling.
  const unique = options.filter(
    (option, index) => options.findIndex((other) => other.value === option.value) === index,
  );
  const chosen = unique.find((option) => option.value === value);
  const shown = chosen?.label ?? (value === "" ? (placeholder ?? "") : value);
  const face = cn(mono && "font-mono", value === "" && "text-muted-foreground italic");

  if (!canEdit) {
    return <span className={face}>{shown}</span>;
  }

  // The select hands back a plain string; finding it among the options is what types it.
  function handleChange(picked: string) {
    const option = unique.find((candidate) => candidate.value === picked);
    if (option !== undefined) {
      onCommit(option.value);
    }
  }

  function renderOption(option: InlineChoiceOption<T>) {
    return (
      <SelectItem key={option.value} value={option.value} className={cn(mono && "font-mono")}>
        {option.label ?? option.value}
        {option.hint !== undefined && (
          <span className="text-muted-foreground ml-2 text-[11px]">{option.hint}</span>
        )}
      </SelectItem>
    );
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      {/* Stripped of its box: in a sentence the words are the affordance, not a field. */}
      <SelectTrigger
        aria-label={label}
        className={cn(
          face,
          "hover:bg-muted dark:hover:bg-muted focus:ring-ring -mx-0.5 inline-flex h-auto w-auto gap-1 rounded-sm border-0 bg-transparent px-0.5 py-0 text-left underline decoration-dotted decoration-from-font underline-offset-4 shadow-none focus:ring-1 dark:bg-transparent",
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{unique.map(renderOption)}</SelectContent>
    </Select>
  );
}
