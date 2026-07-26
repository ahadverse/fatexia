import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@fatexia/ui';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads data on mount and whenever `deps` change.
 *
 * Every list page needs the same three states and a way to refetch after a mutation.
 * Results from a superseded request are discarded (the `requestId` guard) so a slow
 * response to an old filter can't overwrite a newer one — the classic symptom of
 * changing a filter twice quickly and seeing the first filter's rows.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const requestId = useRef(0);

  // The loader is usually an inline arrow, so it is a new function every render;
  // depending on it directly would loop. `deps` is the real dependency list.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    loaderRef
      .current()
      .then((result) => {
        if (id !== requestId.current) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (id !== requestId.current) return;
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { data, loading, error, reload };
}

// Wraps a mutation with the toast-on-result handling every action button repeats.
export async function runAction<T>(
  action: () => Promise<T>,
  { success, onDone }: { success: string; onDone?: () => void },
): Promise<T | null> {
  try {
    const result = await action();
    toast.success(success);
    onDone?.();
    return result;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Action failed');
    return null;
  }
}
