import React from "react";
import { useFormContext, FieldError, Controller } from "react-hook-form";

interface DatePickerProps {
  name: string;
  label: string;
  disabled?: boolean;
  helpText?: string;
  minDate?: Date;
  maxDate?: Date;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  name,
  label,
  disabled = false,
  helpText,
  minDate,
  maxDate,
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();

  const error = errors[name] as FieldError | undefined;

  const formatDateForInput = (date: Date | null): string => {
    if (!date) return "";
    return date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
  };

  const parseInputDate = (dateString: string): Date => {
    return new Date(dateString);
  };

  return (
    <div className="space-y-2">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <input
            id={name}
            type="date"
            disabled={disabled}
            min={minDate ? formatDateForInput(minDate) : undefined}
            max={maxDate ? formatDateForInput(maxDate) : undefined}
            value={formatDateForInput(field.value)}
            onChange={(e) => field.onChange(parseInputDate(e.target.value))}
            className={`block w-full px-3 py-2 border rounded-md shadow-sm text-black ${
              error
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:ring-indigo-500"
            } focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-offset-2`}
          />
        )}
      />
      {helpText && <p className="mt-1 text-sm text-gray-500">{helpText}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error.message}</p>}
    </div>
  );
};

export default DatePicker;
