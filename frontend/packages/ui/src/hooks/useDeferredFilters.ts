'use client';

import { useCallback, useMemo, useState } from 'react';

export interface DeferredFilters<T> {
  /** What the controls are bound to. Changing this does not refetch. */
  draft: T;
  setDraft: (next: T | ((current: T) => T)) => void;
  /** What the query actually uses. Only moves when `apply()` is called. */
  applied: T;
  apply: () => void;
  /** Resets both draft and applied to the initial value. */
  clear: () => void;
  /** Draft differs from applied — used to highlight the Filter button. */
  dirty: boolean;
}

/**
 * Two-stage filter state: edit a draft, then commit it with a Filter button.
 *
 * Filters used to apply on every keystroke/selection, which fires a query per change
 * and makes setting three filters cost three round-trips against a table of millions
 * of clicks. Deferring means one request for one intent, and it is what the reference
 * screens do — they have explicit Filter and Clear buttons.
 *
 * Comparison is by JSON rather than reference because the draft is a plain object
 * rebuilt on every edit; reference equality would report dirty forever.
 */
export function useDeferredFilters<T>(initial: T): DeferredFilters<T> {
  const [draft, setDraft] = useState<T>(initial);
  const [applied, setApplied] = useState<T>(initial);

  const apply = useCallback(() => setApplied(draft), [draft]);

  const clear = useCallback(() => {
    setDraft(initial);
    setApplied(initial);
    // `initial` is expected to be a stable literal from the caller's module scope or a
    // useMemo; it is intentionally not in the dep list to avoid resetting on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(applied), [draft, applied]);

  return { draft, setDraft, applied, apply, clear, dirty };
}
