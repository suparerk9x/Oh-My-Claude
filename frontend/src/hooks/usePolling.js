import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';

export function usePolling(endpoint, interval = 2000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, interval);
    return () => clearInterval(id);
  }, [fetchData, interval]);

  return { data, loading, error, refetch: fetchData };
}

export function useStatus() {
  return usePolling('/status', 2000);
}

export function useSessions() {
  return usePolling('/sessions', 2000);
}

export function useAgents() {
  return usePolling('/agents', 2000);
}

export function useTokens() {
  return usePolling('/tokens', 2000);
}

export function useTasks() {
  return usePolling('/tasks', 2000);
}
