import { useState, useEffect, useCallback } from "react";

const DEFAULT_POLL_INTERVAL = 5000; // 5 seconds
const DEFAULT_RETRY_DELAY = 500; // 500ms retry for slow Logseq API initialization

interface UsePollingOptions<T> {
  fetcher: () => Promise<T>;
  interval?: number;
  retryDelay?: number;
}

/**
 * Hook that polls data at a regular interval with an immediate initial fetch
 * and a short retry delay as a safety net for slow API initialization.
 */
export function usePolling<T>({
  fetcher,
  interval = DEFAULT_POLL_INTERVAL,
  retryDelay = DEFAULT_RETRY_DELAY,
}: UsePollingOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (err) {
      console.error("[usePolling] Fetch error:", err);
      setError("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    // Initial fetch immediately
    fetchData();

    // Retry shortly after as safety net (Logseq API may not be ready)
    const retryId = setTimeout(fetchData, retryDelay);

    // Regular polling
    const intervalId = setInterval(fetchData, interval);

    return () => {
      clearTimeout(retryId);
      clearInterval(intervalId);
    };
  }, [fetchData, interval, retryDelay]);

  return { data, loading, error, refetch: fetchData };
}
