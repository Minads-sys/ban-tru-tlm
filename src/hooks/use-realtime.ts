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
 * Tích hợp cơ chế tự phục hồi: Tự kết nối lại, tự làm mới khi chuyển tab, và polling dự phòng nhẹ.
 * 
 * @example
 * useRealtime({
 *   table: 'monthly_bills',
 *   onChanged: () => fetchBills(),
 * });
 */
export function useRealtime({ table, onChanged }: UseRealtimeOptions) {
  const onChangedRef = useRef(onChanged);

  // Giữ callback luôn mới nhất mà không gây re-subscribe
  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let eventSource: EventSource | null = null;
    let pollTimer: NodeJS.Timeout | null = null;
    let isSubscribed = true;

    // 1. Khởi tạo kết nối SSE tới máy chủ VPS
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
          // Gọi callback cập nhật dữ liệu
          onChangedRef.current();
        } catch {
          // Tin nhắn raw hoặc không phải JSON
        }
      };

      eventSource.onerror = () => {
        // Trình duyệt sẽ tự động kết nối lại SSE theo chuẩn HTTP EventSource
      };
    } catch (err) {
      console.warn('[useRealtime] Failed to initialize EventSource:', err);
    }

    // 2. Tự động làm mới khi người dùng quay lại tab (Focus / Visibility)
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && isSubscribed) {
        onChangedRef.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // 3. Smart Resilient Polling dự phòng (đảm bảo 100% không sót trạng thái kể cả khi mạng lag)
    // Đối với hóa đơn thanh toán: thăm dò mỗi 3.5 giây khi tab đang mở
    // Đối với các bảng khác: thăm dò mỗi 12 giây
    const isPaymentChannel = table === 'monthly_bills' || table === 'payment_transactions';
    const pollInterval = isPaymentChannel ? 3500 : 12000;

    pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && isSubscribed) {
        onChangedRef.current();
      }
    }, pollInterval);

    // Cleanup khi component unmount
    return () => {
      isSubscribed = false;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [table]);
}
