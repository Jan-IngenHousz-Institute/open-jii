import React from "react";
import { useFormContext, FieldError } from "react-hook-form";

interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps {
  name: string;
  label: string;
  options: RadioOption[];
  disabled?: boolean;
  helpText?: string;
  direction?: "horizontal" | "vertical";
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  label,
  options,
  disabled = false,
  helpText,
  direction = "vertical",
}) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const error = errors[name] as FieldError | undefined;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div
        className={`${
          direction === "vertical"
            ? "flex flex-col space-y-2"
            : "flex space-x-4"
        }`}
      >
        {options.map((option) => (
          <div key={option.value} className="flex items-center">
            <input
              id={`${name}-${option.value}`}
              type="radio"
              value={option.value}
              {...register(name)}
              disabled={disabled}
              className={`h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500 ${
                error ? "border-red-500" : ""
              }`}
            />
            <label
              htmlFor={`${name}-${option.value}`}
              className="ml-2 block text-sm text-gray-700"
            >
              {option.label}
            </label>
          </div>
        ))}
      </div>
      {helpText && <p className="mt-1 text-sm text-gray-500">{helpText}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error.message}</p>}
    </div>
  );
};

export default RadioGroup;
