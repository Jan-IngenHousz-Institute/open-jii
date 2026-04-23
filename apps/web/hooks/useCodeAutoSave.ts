import { useCallback, useEffect, useRef, useState } from "react";
import { parseApiError } from "~/util/apiError";

import { toast } from "@repo/ui/hooks/use-toast";

type SyncStatus = "synced" | "unsynced" | "syncing";

interface UseCodeAutoSaveOptions<TCode, TSavePayload> {
  /** The mutate function from the update hook (non-async, for debounced saves) */
  saveFn: (
    payload: TSavePayload,
    options?: { onSuccess?: () => void; onError?: (err: unknown) => void },
  ) => void;
  /** Build the save payload from the current code value */
  buildPayload: (code: TCode) => TSavePayload;
  /** Serialize code to a string key for dirty-checking */
  toKey: (code: TCode) => string;
  /** Check if a raw onChange value is valid for saving (e.g. Array.isArray check) */
  isValid?: (value: TCode) => boolean;
  /** Debounce delay in ms (default 1000) */
  delay?: number;
}

interface UseCodeAutoSaveReturn<TCode> {
  isEditing: boolean;
  editedCode: TCode;
  syncStatus: SyncStatus;
  startEditing: (initialCode: TCode) => void;
  closeEditing: () => void;
  handleChange: (value: TCode) => void;
}

export function useCodeAutoSave<TCode, TSavePayload>({
  saveFn,
  buildPayload,
  toKey,
  isValid,
  delay = 1000,
}: UseCodeAutoSaveOptions<TCode, TSavePayload>): UseCodeAutoSaveReturn<TCode> {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState<TCode>(undefined as TCode);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const savedKeyRef = useRef("");
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ref = saveTimeoutRef;
    return () => {
      if (ref.current) clearTimeout(ref.current);
    };
  }, []);

  const startEditing = useCallback(
    (initialCode: TCode) => {
      setEditedCode(initialCode);
      savedKeyRef.current = toKey(initialCode);
      setSyncStatus("synced");
      setIsEditing(true);
    },
    [toKey],
  );

  const closeEditing = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (isValid ? isValid(editedCode) : true) {
      const key = toKey(editedCode);
      if (key !== savedKeyRef.current) {
        saveFnRef.current(buildPayload(editedCode));
      }
    }
    setIsEditing(false);
  }, [editedCode, toKey, buildPayload, isValid]);

  const handleChange = useCallback(
    (value: TCode) => {
      setEditedCode(value);
      if (isValid && !isValid(value)) return;

      const key = toKey(value);
      if (key === savedKeyRef.current) {
        setSyncStatus("synced");
        return;
      }

      setSyncStatus("unsynced");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setSyncStatus("syncing");
        saveFnRef.current(buildPayload(value), {
          onSuccess: () => {
            savedKeyRef.current = key;
            setSyncStatus("synced");
          },
          onError: (err) => {
            toast({ description: parseApiError(err)?.message, variant: "destructive" });
            setSyncStatus("unsynced");
          },
        });
      }, delay);
    },
    [toKey, buildPayload, isValid, delay],
  );

  return { isEditing, editedCode, syncStatus, startEditing, closeEditing, handleChange };
}
