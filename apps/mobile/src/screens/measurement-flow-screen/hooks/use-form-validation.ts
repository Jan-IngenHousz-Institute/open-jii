import React, { createContext, useContext, useState } from "react";

interface FormValidationContextType {
  isValid: boolean;
  setValid: (valid: boolean) => void;
}

const FormValidationContext = createContext<FormValidationContextType | null>(null);

export function FormValidationProvider({ children }: { children: any }) {
  const [isValid, setIsValid] = useState(true);

  const setValid = (valid: boolean) => {
    setIsValid(valid);
  };

  return React.createElement(
    FormValidationContext.Provider,
    { value: { isValid, setValid } },
    children,
  );
}

export function useFormValidation() {
  const context = useContext(FormValidationContext);
  if (!context) {
    throw new Error("useFormValidation must be used within FormValidationProvider");
  }
  return context;
}
