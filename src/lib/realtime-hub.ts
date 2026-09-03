import { EventEmitter } from 'events';

// Định nghĩa kiểu dữ liệu sự kiện Realtime
export type RealtimeChannel =
  | 'monthly_bills'
  | 'payment_transactions'
  | 'meal_cancellations'
  | 'daily_meals'
  | 'students'
  | 'classes'
  | 'schedules'
  | '*';

export interface RealtimeEventPayload {
  table: string;
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  data?: any;
  timestamp: number;
}

// Giữ instance singleton trong môi trường Node.js
declare global {
  // eslint-disable-next-line no-var
  var __realtimeHub: EventEmitter | undefined;
}

const realtimeHub: EventEmitter = global.__realtimeHub || new EventEmitter();
realtimeHub.setMaxListeners(100);

if (!global.__realtimeHub) {
  global.__realtimeHub = realtimeHub;
}

/**
 * Phát tín hiệu thay đổi dữ liệu xuống các client đang kết nối
 * @param table Bảng / Kênh dữ liệu (monthly_bills, meal_cancellations, students...)
 * @param eventType Loại thay đổi (INSERT, UPDATE, DELETE, *)
 * @param data Dữ liệu kèm theo (tùy chọn)
 */
export function broadcastChange(
  table: RealtimeChannel,
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | '*' = '*',
  data?: any
) {
  const payload: RealtimeEventPayload = {
    table,
    eventType,
    data,
    timestamp: Date.now(),
  };

  try {
    realtimeHub.emit('change', payload);
  } catch (err) {
    console.error('[RealtimeHub] Error broadcasting change:', err);
  }
}

export default realtimeHub;
