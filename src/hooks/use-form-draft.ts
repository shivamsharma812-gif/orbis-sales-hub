import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lightweight autosave for unsubmitted create-forms.
 * Drafts are stored per authenticated user and per form type in localStorage,
 * survive closing the dialog / refreshing the tab, and are only removed on a
 * successful submit or an explicit discard.
 */

export const DRAFT_VERSION = 1;

export type DraftType = "lead" | "client";

interface StoredDraft<T> {
  version: number;
  type: DraftType;
  userId: string;
  updatedAt: string;
  formData: Partial<T>;
}

function draftKey(type: DraftType, userId: string) {
  return `crm:create-${type}-draft:${userId}`;
}

function readRaw<T extends object>(type: DraftType, userId: string): StoredDraft<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(type, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== DRAFT_VERSION) return null;
    if (parsed.type !== type || parsed.userId !== userId) return null;
    if (!parsed.formData || typeof parsed.formData !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function isEmptyValue(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** True when the form differs from its defaults in a way worth keeping. */
export function hasMeaningfulInput<T extends object>(value: T, defaults: T): boolean {
  return Object.keys(value).some((k) => {
    const key = k as keyof T;
    const v = value[key];
    if (JSON.stringify(v) === JSON.stringify(defaults[key])) return false;
    return !isEmptyValue(v);
  });
}

export function useFormDraft<T extends object>(options: {
  type: DraftType;
  userId: string | null | undefined;
  value: T;
  defaults: T;
  /** Only autosave while the dialog is open. */
  active: boolean;
}) {
  const { type, userId, value, defaults, active } = options;
  const [hasDraft, setHasDraft] = useState(false);
  const suspended = useRef(false);

  const refresh = useCallback(() => {
    if (!userId) return setHasDraft(false);
    setHasDraft(!!readRaw<T>(type, userId));
  }, [type, userId]);

  useEffect(() => {
    refresh();
  }, [refresh, active]);

  const clearDraft = useCallback(() => {
    suspended.current = true;
    if (!userId) return;
    try {
      window.localStorage.removeItem(draftKey(type, userId));
    } catch {
      /* storage unavailable — nothing to clean up */
    }
    setHasDraft(false);
  }, [type, userId]);

  /** Reads the stored draft merged over the given defaults, or null. */
  const loadDraft = useCallback(
    (base: T): T | null => {
      if (!userId) return null;
      const stored = readRaw<T>(type, userId);
      if (!stored) return null;
      suspended.current = false;
      return { ...base, ...stored.formData };
    },
    [type, userId],
  );

  // Debounced autosave while the form is open.
  useEffect(() => {
    if (!active || !userId || suspended.current) return;
    const handle = window.setTimeout(() => {
      try {
        if (!hasMeaningfulInput(value, defaults)) {
          window.localStorage.removeItem(draftKey(type, userId));
          setHasDraft(false);
          return;
        }
        const payload: StoredDraft<T> = {
          version: DRAFT_VERSION,
          type,
          userId,
          updatedAt: new Date().toISOString(),
          formData: value,
        };
        window.localStorage.setItem(draftKey(type, userId), JSON.stringify(payload));
        setHasDraft(true);
      } catch {
        /* persistence is best-effort: never break the form */
      }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [active, userId, type, value, defaults]);

  return { hasDraft, loadDraft, clearDraft, refreshDraft: refresh };
}
