'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions {
  table: string;
  event?: PostgresChangeEvent;
  schema?: string;
  filter?: string;
  onChanged: () => void;
}

/**
 * Hook để lắng nghe thay đổi realtime từ Supabase.
 * Khi có INSERT/UPDATE/DELETE trên bảng chỉ định, callback `onChanged` sẽ được gọi.
 * 
 * @example
 * useRealtime({
 *   table: 'meal_cancellations',
 *   event: '*',
 *   onChanged: () => fetchCancellations(),
 * });
 */
export function useRealtime({ table, event = '*', schema = 'public', filter, onChanged }: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onChangedRef = useRef(onChanged);

  // Keep callback ref fresh without re-subscribing
  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  useEffect(() => {
    // Nếu chưa cấu hình Supabase URL thì bỏ qua (chạy local không có realtime)
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return;
    }

    const channelName = `realtime-${table}-${event}-${filter || 'all'}`;

    const filterConfig: Record<string, unknown> = {
      event,
      schema,
      table,
    };
    if (filter) {
      filterConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as never,
        filterConfig as never,
        () => {
          onChangedRef.current();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, event, schema, filter]);
}
