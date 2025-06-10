import { useState } from "react";

export interface UseDesignSystemLogic {
  // State for interactive demos
  inputValue: string;
  dropdownValue: string;

  // Actions
  setInputValue: (value: string) => void;
  setDropdownValue: (value: string) => void;
}

export function useDesignSystemLogic(): UseDesignSystemLogic {
  const [inputValue, setInputValue] = useState("");
  const [dropdownValue, setDropdownValue] = useState("");

  return {
    // State
    inputValue,
    dropdownValue,

    // Actions
    setInputValue,
    setDropdownValue,
  };
}
