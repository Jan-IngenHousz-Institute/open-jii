"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";

interface InlineChoiceOption {
  value: string;
  label?: string;
  hint?: string;
}

/** A value inside a sentence that comes from a list the rig or the driver already fixed. */
interface InlineChoiceProps {
  value: string;
  label: string;
  options: InlineChoiceOption[];
  canEdit: boolean;
  onCommit: (value: string) => void;
  mono?: boolean;
  placeholder?: string;
}

export function InlineChoice({
  value,
  label,
  options,
  canEdit,
  onCommit,
  mono = true,
  placeholder,
}: InlineChoiceProps) {
  const chosen = options.find((option) => option.value === value);
  const shown = chosen?.label ?? (value === "" ? (placeholder ?? "") : value);
  const face = cn(mono && "font-mono", value === "" && "text-muted-foreground italic");

  if (!canEdit) {
    return <span className={face}>{shown}</span>;
  }

  return (
    <Select value={value} onValueChange={onCommit}>
      {/* Stripped of its box: in a sentence the words are the affordance, not a field. */}
      <SelectTrigger
        aria-label={label}
        className={cn(
          face,
          "hover:bg-muted focus:ring-ring -mx-0.5 inline-flex h-auto w-auto gap-1 rounded-sm border-0 bg-transparent px-0.5 py-0 text-left underline decoration-dotted decoration-from-font underline-offset-4 shadow-none focus:ring-1",
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className={cn(mono && "font-mono")}>
            {option.label ?? option.value}
            {option.hint !== undefined && (
              <span className="text-muted-foreground ml-2 text-[11px]">{option.hint}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
