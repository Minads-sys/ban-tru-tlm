import { NextRequest } from 'next/server';
import realtimeHub, { RealtimeEventPayload } from '@/lib/realtime-hub';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestedTable = searchParams.get('table');

  const encoder = new TextEncoder();

  let removeListener: (() => void) | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Gửi event chào mừng để xác nhận kết nối SSE thành công
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', table: requestedTable || '*' })}\n\n`)
        );
      } catch {}

      const listener = (payload: RealtimeEventPayload) => {
        if (!requestedTable || requestedTable === '*' || payload.table === requestedTable || payload.table === '*') {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          } catch {
            cleanUp();
          }
        }
      };

      realtimeHub.on('change', listener);
      removeListener = () => {
        realtimeHub.off('change', listener);
      };

      // Heartbeat mỗi 15 giây để duy trì kết nối qua Nginx/Proxy
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          cleanUp();
        }
      }, 15000);

      function cleanUp() {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (removeListener) {
          removeListener();
          removeListener = null;
        }
        try {
          controller.close();
        } catch {}
      }

      request.signal.addEventListener('abort', () => {
        cleanUp();
      });
    },
    cancel() {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (removeListener) removeListener();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Tắt buffer Nginx để SSE truyền tức thời
    },
  });
}
