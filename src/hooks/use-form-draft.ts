"use client";

import { useEffect, useState } from "react";
import { clearDraft, loadDraft, saveDraft } from "@/lib/form-drafts";

interface UseFormDraftOptions<T> {
  /** Storage key for this form context, or null to disable drafts (e.g. edit mode). */
  key: string | null;
  data: T;
  /** Whether the current data holds anything worth keeping. */
  isDirty: boolean;
  /** Called during render with a stored draft the first time a key becomes available. */
  onRestore: (draft: T) => void;
}

/**
 * Restores a saved draft once per key, then keeps localStorage in step with
 * the form: dirty data is saved, pristine data (e.g. after submit) clears it.
 * Returns the key of the most recently restored draft so callers can notify.
 */
export function useFormDraft<T>({ key, data, isDirty, onRestore }: UseFormDraftOptions<T>) {
  const [checkedKey, setCheckedKey] = useState<string | null>(null);
  const [restoredKey, setRestoredKey] = useState<string | null>(null);

  if (key && checkedKey !== key) {
    setCheckedKey(key);
    const draft = loadDraft<T>(key);
    if (draft) {
      setRestoredKey(key);
      onRestore(draft);
    }
  }

  useEffect(() => {
    // Wait until the stored draft (if any) has been restored, or the pristine
    // initial form would wipe it.
    if (!key || checkedKey !== key) return;
    if (isDirty) saveDraft(key, data);
    else clearDraft(key);
  }, [key, checkedKey, data, isDirty]);

  return restoredKey;
}
