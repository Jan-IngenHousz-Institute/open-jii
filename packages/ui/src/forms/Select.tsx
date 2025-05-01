import React from "react";
import { useFormContext, FieldError } from "react-hook-form";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  name: string;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  helpText?: string;
  emptyOptionLabel?: string;
}

export const Select: React.FC<SelectProps> = ({
  name,
  label,
  options,
  placeholder,
  disabled = false,
  helpText,
  emptyOptionLabel = "Select an option",
}) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const error = errors[name] as FieldError | undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={name}
        {...register(name)}
        disabled={disabled}
        className={`block w-full px-3 py-2 border rounded-md shadow-sm text-black ${
          error
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:ring-indigo-500"
        } focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-offset-2`}
      >
        <option value="">{emptyOptionLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helpText && <p className="mt-1 text-sm text-gray-500">{helpText}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error.message}</p>}
    </div>
  );
};

export default Select;
