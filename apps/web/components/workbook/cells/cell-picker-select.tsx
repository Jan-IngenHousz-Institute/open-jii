"use client";

import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

export interface CellPickerOption {
  value: string;
  label: string;
  className?: string;
}

interface CellPickerSelectProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: CellPickerOption[];
  placeholder: string;
  triggerClassName: string;
  disabled?: boolean;
}

function renderOption(option: CellPickerOption) {
  return (
    <SelectItem key={option.value} value={option.value} className={option.className ?? "text-xs"}>
      {option.label}
    </SelectItem>
  );
}

/**
 * A Select over a workbook's cells whose options mount only while it is open. A closed Radix
 * Select still renders every item to find the selected label, and a large workbook's branch cells
 * turned that into hundreds of thousands of nodes and an 18 s freeze.
 */
export function CellPickerSelect({
  value,
  onValueChange,
  options,
  placeholder,
  triggerClassName,
  disabled,
}: CellPickerSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      open={isOpen}
      onOpenChange={setIsOpen}
      disabled={disabled}
    >
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder}>{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>{isOpen && options.map(renderOption)}</SelectContent>
    </Select>
  );
}
