import type { Measurer } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Label } from "@repo/ui/components/label";

interface MeasurerPickerProps {
  measurers: readonly Measurer[];
  value: readonly string[];
  onChange: (userIds: string[]) => void;
  isDisabled: boolean;
}

export function MeasurerPicker({ measurers, value, onChange, isDisabled }: MeasurerPickerProps) {
  const toggle = (userId: string, isChecked: boolean) => {
    onChange(isChecked ? [...value, userId] : value.filter((id) => id !== userId));
  };

  const renderMeasurer = (measurer: Measurer) => {
    const inputId = `measurer-${measurer.userId}`;
    const handleCheckedChange = (checked: boolean | "indeterminate") => {
      toggle(measurer.userId, checked === true);
    };

    return (
      <div key={measurer.userId} className="flex items-center gap-2">
        <Checkbox
          id={inputId}
          checked={value.includes(measurer.userId)}
          onCheckedChange={handleCheckedChange}
          disabled={isDisabled}
        />
        <Label htmlFor={inputId} className="cursor-pointer font-normal">
          {measurer.name}
        </Label>
      </div>
    );
  };

  return <div className="space-y-2">{measurers.map(renderMeasurer)}</div>;
}
