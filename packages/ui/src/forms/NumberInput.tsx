import React from "react";
import { useFormContext, FieldError } from "react-hook-form";

interface NumberInputProps {
  name: string;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  helpText?: string;
  min?: number;
  max?: number;
  step?: number;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  name,
  label,
  placeholder,
  disabled = false,
  helpText,
  min,
  max,
  step,
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
      <input
        id={name}
        type="number"
        {...register(name, { valueAsNumber: true })}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className={`block w-full px-3 py-2 border rounded-md shadow-sm text-black ${
          error
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:ring-indigo-500"
        } focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-offset-2`}
      />
      {helpText && <p className="mt-1 text-sm text-gray-500">{helpText}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error.message}</p>}
    </div>
  );
};

export default NumberInput;
