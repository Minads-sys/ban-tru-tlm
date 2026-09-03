'use client';

import { useEffect, useRef } from 'react';

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions {
  table: string;
  event?: PostgresChangeEvent;
  schema?: string;
  filter?: string;
  onChanged: () => void;
}

/**
 * Hook lắng nghe thay đổi Realtime từ máy chủ VPS (qua Server-Sent Events - SSE).
 * Chỉ kích hoạt khi máy chủ THỰC SỰ có thay đổi (sự kiện phát ra) hoặc khi người dùng quay lại tab.
 * Tuyệt đối không dùng polling định kỳ để tránh chớp/load lại màn hình.
 */
export function useRealtime({ table, onChanged }: UseRealtimeOptions) {
  const onChangedRef = useRef(onChanged);

  // Giữ callback luôn mới nhất
  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let eventSource: EventSource | null = null;
    let isSubscribed = true;

    // 1. Khởi tạo kết nối SSE tức thời tới máy chủ VPS
    try {
      const sseUrl = `/api/realtime?table=${encodeURIComponent(table)}`;
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const payload = JSON.parse(event.data);
          // Bỏ qua tin nhắn heartbeat hoặc kết nối ban đầu
          if (payload?.type === 'CONNECTED' || payload?.type === 'HEARTBEAT') {
            return;
          }
          // Chỉ gọi làm mới khi máy chủ THỰC SỰ phát sự kiện có dữ liệu thay đổi
          onChangedRef.current();
        } catch {
          // Bỏ qua tin nhắn heartbeat dạng text
        }
      };

      eventSource.onerror = () => {
        // Trình duyệt tự động kết nối lại ngầm theo chuẩn SSE khi mạng gián đoạn
      };
    } catch (err) {
      console.warn('[useRealtime] Failed to initialize EventSource:', err);
    }

    // 2. Chỉ làm mới khi người dùng chuyển tab và quay trở lại màn hình
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && isSubscribed) {
        onChangedRef.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // Cleanup khi component unmount
    return () => {
      isSubscribed = false;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [table]);
}
