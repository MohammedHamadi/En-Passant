'use client';
import {
  useCallback,
  useEffect,
  useState,
  useRef
} from 'react';
export async function api < T = unknown > (path: string, method = 'GET', body ? : unknown) {
  const response = await fetch(`/api/${path}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body == null ? {} : {
      'Content-Type': 'application/json'
    },
    body: body == null ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({
    error: 'Unable to read the server response.'
  }));
  if (!response.ok) throw Object.assign(new Error(payload.error || 'Request failed.'), {
    status: response.status,
    retryAfter: Number(response.headers.get('retry-after') || 0)
  });
  return payload as T;
}
export function useLive < T extends {
  server_time ? : string
} > (path: string) {
  const [payload, setPayload] = useState < T | null > (null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const requestId = ++sequence.current;
    const start = Date.now();
    try {
      const result = await api < T > (path);
      if (requestId !== sequence.current) return;
      setPayload(result);
      setError('');
      if (result.server_time) setOffset(Date.parse(result.server_time) - (start + Date.now()) / 2);
    } catch (error) {
      if (requestId === sequence.current) setError(error.message);
    } finally {
      if (requestId === sequence.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType < typeof setTimeout > ;
    async function poll() {
      if (document.visibilityState === 'visible') await reload();
      if (!stopped) timer = setTimeout(poll, 5000);
    }
    void poll();
    return () => {
      stopped = true;
      sequence.current++;
      clearTimeout(timer);
    };
  }, [reload]);
  return {
    payload,
    error,
    loading,
    offset,
    reload
  };
}
