'use client';

import { useRouter } from 'next/navigation';
import { useRealtime } from '@/hooks/use-realtime';

interface RealtimeRefresherProps {
  /** Tên bảng PostgreSQL cần lắng nghe (ví dụ: 'meal_cancellations') */
  table: string;
  /** Lắng nghe nhiều bảng cùng lúc */
  tables?: string[];
}

/**
 * Component ẩn, không hiển thị gì trên giao diện.
 * Khi có thay đổi trên bảng chỉ định, tự động làm mới trang (server component re-render).
 * 
 * Dùng cho các trang admin dạng Server Component:
 * ```tsx
 * // Trong server component page.tsx:
 * <RealtimeRefresher table="meal_cancellations" />
 * ```
 */
export function RealtimeRefresher({ table, tables }: RealtimeRefresherProps) {
  const router = useRouter();

  const allTables = tables ? tables : [table];

  return (
    <>
      {allTables.map((t) => (
        <RealtimeListener key={t} table={t} onChanged={() => router.refresh()} />
      ))}
    </>
  );
}

function RealtimeListener({ table, onChanged }: { table: string; onChanged: () => void }) {
  useRealtime({
    table,
    event: '*',
    onChanged,
  });

  return null;
}
