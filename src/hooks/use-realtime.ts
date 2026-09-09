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

type ListenerCallback = () => void;

/**
 * Singleton SSE Manager:
 * Toàn bộ ứng dụng dùng chung DUY NHẤT 1 kết nối EventSource tới /api/realtime.
 * Loại bỏ hoàn toàn giới hạn socket và tránh mở lặp nhiều kết nối ngầm.
 */
class RealtimeClientManager {
  private static instance: RealtimeClientManager;
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<ListenerCallback>> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private lastHiddenTime: number = 0;

  private constructor() {
    if (typeof window !== 'undefined') {
      // Ghi nhận thời điểm ẩn tab để chỉ refresh khi tab bị ẩn quá 60 giây
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.lastHiddenTime = Date.now();
        } else if (document.visibilityState === 'visible') {
          const hiddenDuration = Date.now() - this.lastHiddenTime;
          // Chỉ thông báo làm mới nếu người dùng rời tab lâu hơn 60 giây
          if (this.lastHiddenTime > 0 && hiddenDuration > 60000) {
            this.notifyAll();
          }
        }
      });
    }
  }

  public static getInstance(): RealtimeClientManager {
    if (!RealtimeClientManager.instance) {
      RealtimeClientManager.instance = new RealtimeClientManager();
    }
    return RealtimeClientManager.instance;
  }

  private connect() {
    if (typeof window === 'undefined' || this.eventSource) return;

    try {
      this.eventSource = new EventSource('/api/realtime');

      this.eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === 'CONNECTED' || payload?.type === 'HEARTBEAT') {
            return;
          }

          const table = payload?.table;
          if (table) {
            this.notifyTable(table);
          } else {
            this.notifyAll();
          }
        } catch {
          // Bỏ qua tin nhắn dạng text hoặc heartbeat
        }
      };

      this.eventSource.onerror = () => {
        // Đóng kết nối cũ nếu có lỗi và thử kết nối lại sau 5s
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        if (!this.reconnectTimer && this.getTotalListenersCount() > 0) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 5000);
        }
      };
    } catch (err) {
      console.warn('[RealtimeManager] Failed to connect SSE:', err);
    }
  }

  private disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private getTotalListenersCount(): number {
    let count = 0;
    this.listeners.forEach((set) => {
      count += set.size;
    });
    return count;
  }

  public subscribe(table: string, callback: ListenerCallback): () => void {
    if (!this.listeners.has(table)) {
      this.listeners.set(table, new Set());
    }
    this.listeners.get(table)!.add(callback);

    // Mở kết nối nếu đây là listener đầu tiên
    if (!this.eventSource) {
      this.connect();
    }

    // Trả về hàm hủy đăng ký
    return () => {
      const set = this.listeners.get(table);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.listeners.delete(table);
        }
      }
      // Đóng kết nối nếu không còn ai lắng nghe
      if (this.getTotalListenersCount() === 0) {
        this.disconnect();
      }
    };
  }

  private notifyTable(table: string) {
    // Thông báo cho các component lắng nghe bảng này
    const tableListeners = this.listeners.get(table);
    if (tableListeners) {
      tableListeners.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          console.error('[RealtimeManager] Error in listener callback:', e);
        }
      });
    }

    // Thông báo cho các component lắng nghe '*' (tất cả bảng)
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          console.error('[RealtimeManager] Error in wildcard callback:', e);
        }
      });
    }
  }

  private notifyAll() {
    this.listeners.forEach((set) => {
      set.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          console.error('[RealtimeManager] Error in notifyAll callback:', e);
        }
      });
    });
  }
}

/**
 * Hook lắng nghe thay đổi Realtime từ máy chủ VPS qua Singleton SSE.
 * Đảm bảo toàn ứng dụng chỉ mở duy nhất 1 kết nối SSE, không gây nghẽn kết nối mạng.
 */
export function useRealtime({ table, onChanged }: UseRealtimeOptions) {
  const onChangedRef = useRef(onChanged);

  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const manager = RealtimeClientManager.getInstance();
    const unsubscribe = manager.subscribe(table, () => {
      onChangedRef.current();
    });

    return () => {
      unsubscribe();
    };
  }, [table]);
}
