import type { Control } from "react-hook-form";

import type { WalkingOrderSettings } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { FormControl, FormField, FormItem, FormLabel } from "@repo/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

interface WalkingAttributePickerProps {
  control: Control<WalkingOrderSettings>;
  name: "balanceOn" | "blocksFrom";
  label: string;
  attributes: readonly string[];
  isDisabled: boolean;
}

/** Picks the plot attribute a strategy reads, from every attribute the plots carry. */
export function WalkingAttributePicker({
  control,
  name,
  label,
  attributes,
  isDisabled,
}: WalkingAttributePickerProps) {
  const renderAttribute = (attribute: string) => (
    <SelectItem key={attribute} value={attribute}>
      {attribute}
    </SelectItem>
  );

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center gap-2 space-y-0">
          <FormLabel className="text-muted-foreground shrink-0 text-xs font-normal">
            {label}
          </FormLabel>
          <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isDisabled}>
            <FormControl>
              <SelectTrigger className="h-8 w-40" data-attribute-picker={name}>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>{attributes.map(renderAttribute)}</SelectContent>
          </Select>
        </FormItem>
      )}
    />
  );
}
