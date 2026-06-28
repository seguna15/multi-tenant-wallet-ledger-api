'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient, BASE_URL } from '@/api/api-client';
import type { Transfer, TransferPage } from '@ledger/types';

const FEED_SIZE = 5;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const POLL_INTERVAL_MS = 10_000;

export type ActivityConnectionStatus = 'connecting' | 'live' | 'polling';

export function useTransferActivityFeed() {
  const [events, setEvents] = useState<Transfer[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ActivityConnectionStatus>('connecting');

  const esRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(BASE_BACKOFF_MS);

  const upsertEvent = useCallback((transfer: Transfer) => {
    setEvents((prev) =>
      [transfer, ...prev.filter((t) => t.id !== transfer.id)].slice(0, FEED_SIZE),
    );
  }, []);

  const fetchRecent = useCallback(async () => {
    try {
      const page = await apiClient.get<TransferPage>(`/transfers/me?limit=${FEED_SIZE}`);
      setEvents(page.items.slice(0, FEED_SIZE));
    } catch {
      // keep showing the last known feed on a transient fetch error
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    setConnectionStatus('polling');
    if (pollTimerRef.current) return;
    fetchRecent();
    pollTimerRef.current = setInterval(fetchRecent, POLL_INTERVAL_MS);
  }, [fetchRecent]);

  const connect = useCallback(() => {
    esRef.current?.close();
    setConnectionStatus((prev) => (prev === 'live' ? 'connecting' : prev));

    const es = new EventSource(`${BASE_URL}/transfers/stream/activity`, { withCredentials: true });
    esRef.current = es;

    es.onopen = () => {
      backoffRef.current = BASE_BACKOFF_MS;
      setConnectionStatus('live');
      stopPolling();
    };

    es.onmessage = async (e) => {
      const payload = JSON.parse(e.data);
      if (payload.type === 'ping') return;

      try {
        const transfer = await apiClient.get<Transfer>(`/transfers/${payload.transferId}`);
        upsertEvent(transfer);
      } catch {
        // dropped event — next reconnect/poll resyncs the feed
      }
    };

    es.onerror = () => {
      es.close();
      startPolling();

      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };
  }, [startPolling, stopPolling, upsertEvent]);

  useEffect(() => {
    fetchRecent();
    connect();

    return () => {
      esRef.current?.close();
      stopPolling();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connect, fetchRecent, stopPolling]);

  return { events, connectionStatus };
}
