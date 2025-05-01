import React from "react";
import { useFormContext, FieldError } from "react-hook-form";

interface CheckboxProps {
  name: string;
  label: string;
  disabled?: boolean;
  helpText?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  name,
  label,
  disabled = false,
  helpText,
}) => {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const error = errors[name] as FieldError | undefined;

  return (
    <div className="flex items-start">
      <div className="flex items-center h-5">
        <input
          id={name}
          type="checkbox"
          {...register(name)}
          disabled={disabled}
          className={`h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 ${
            error ? "border-red-500" : ""
          }`}
        />
      </div>
      <div className="ml-3 text-sm">
        <label htmlFor={name} className="font-medium text-gray-700">
          {label}
        </label>
        {helpText && <p className="text-gray-500">{helpText}</p>}
        {error && <p className="text-red-600">{error.message}</p>}
      </div>
    </div>
  );
};

export default Checkbox;
