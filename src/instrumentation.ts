/**
 * Next.js Instrumentation Hook
 * 
 * File này được Next.js gọi DUY NHẤT 1 LẦN khi server khởi động.
 * Dùng để khởi chạy In-App Scheduler duyệt cắt suất tự động đúng giờ chốt.
 * 
 * Tham khảo: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Chỉ chạy scheduler ở phía server Node.js (không chạy trên Edge runtime hoặc client)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startScheduler } = await import("@/lib/scheduler");
      await startScheduler();
    } catch (error) {
      console.error("[Instrumentation] ❌ Lỗi khi khởi động Scheduler:", error);
    }
  }
}
