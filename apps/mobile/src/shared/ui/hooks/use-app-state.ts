import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import type { AppStateStatus } from "react-native";

/**
 * Subscribes a handler to AppState change events with automatic cleanup.
 * The handler is read through a ref so the subscription doesn't re-bind
 * on every render — callers can pass an inline arrow without memoisation.
 */
export function useAppState(handler: (nextState: AppStateStatus) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      handlerRef.current(nextState);
    });
    return () => sub.remove();
  }, []);
}
