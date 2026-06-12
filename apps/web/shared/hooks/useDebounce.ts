import { useState, useEffect } from "react";

/**
 * A hook that debounces a value.
 * @param value The value to debounce
 * @param delay The delay in ms (default: 300ms)
 * @returns The debounced value and isDebounced state (false when debouncing is in progress)
 */
export function useDebounce<T>(value: T, delay = 300): [T, boolean] {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [isDebounced, setIsDebounced] = useState<boolean>(true);

  useEffect(() => {
    // Set isDebounced to false when value changes (debouncing in progress)
    setIsDebounced(false);

    const timer = setTimeout(() => {
      setDebouncedValue(value);
      setIsDebounced(true);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return [debouncedValue, isDebounced];
}
