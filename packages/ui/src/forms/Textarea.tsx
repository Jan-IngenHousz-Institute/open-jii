import React from "react";
import { useFormContext, FieldError } from "react-hook-form";

interface TextareaProps {
  name: string;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  helpText?: string;
  maxLength?: number;
  rows?: number;
}

export const Textarea: React.FC<TextareaProps> = ({
  name,
  label,
  placeholder,
  disabled = false,
  helpText,
  maxLength,
  rows = 4,
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
      <textarea
        id={name}
        {...register(name)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        rows={rows}
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

export default Textarea;
