import { useCallback, useEffect, useState } from "react";

/**
 * Wraps the "fetch on mount, expose loading/error, allow manual refresh"
 * pattern that Reconciliation, Loans, and Community each hand-rolled
 * separately. `fetchFn` is called on mount and whenever `deps` changes;
 * call the returned `refresh()` to re-fetch after a mutation (e.g. after
 * issuing a loan or logging a payment).
 *
 * @param {() => Promise<any>} fetchFn
 * @param {Array} deps
 * @returns {{ data: any, error: string, loading: boolean, refresh: () => Promise<void>, setData: Function }}
 */
export function useApiData(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    setError("");
    return fetchFn()
      .then((result) => {
        setData(result);
        return result;
      })
      .catch((e) => {
        setError(e.message || "Something went wrong.");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, error, loading, refresh, setData };
}
