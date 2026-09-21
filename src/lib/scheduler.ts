/**
 * BAN-TRU-TLM — In-App Scheduler
 * 
 * Bộ hẹn giờ chạy bên trong process Node.js của Next.js server.
 * Tự động gọi duyệt cắt suất + đồng bộ chốt suất đúng giờ chốt sáng mỗi ngày.
 * 
 * Ưu điểm:
 * - Không cần cài thêm thư viện (dùng setTimeout thuần)
 * - Không cần cấu hình crontab trên VPS
 * - Chạy tự động khi server khởi động qua instrumentation.ts
 */

import prisma from "@/lib/db";
import { autoApproveExpiredCancellations } from "@/app/admin/meal-cancel/actions";
import { syncDailyMealSummaryForDate } from "@/lib/daily-meals";
import { getVietnamTodayUTC } from "@/lib/utils";

// Guard chống khởi tạo trùng (singleton)
let isSchedulerRunning = false;
let currentTimerId: ReturnType<typeof setTimeout> | null = null;

/**
 * Lấy giờ chốt sáng từ cài đặt hệ thống (MEAL_LOCK_TIME_2 hoặc CUTOFF_TIME)
 * Mặc định: "07:00"
 */
async function getCutoffTime(): Promise<string> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ["MEAL_LOCK_TIME_2", "CUTOFF_TIME"] } },
    });
    return (
      settings.find((s) => s.key === "MEAL_LOCK_TIME_2")?.value ||
      settings.find((s) => s.key === "CUTOFF_TIME")?.value ||
      "07:00"
    );
  } catch {
    console.warn("[Scheduler] Không đọc được giờ chốt từ DB, dùng mặc định 07:00");
    return "07:00";
  }
}

/**
 * Lấy thời điểm hiện tại theo giờ Việt Nam
 */
function getVietnamNow(): Date {
  const vnTimeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
  return new Date(vnTimeStr);
}

/**
 * Tính số mili-giây từ bây giờ đến giờ chốt (hôm nay hoặc ngày mai)
 */
function getMillisecondsUntilCutoff(cutoffTime: string): number {
  const [targetHours, targetMinutes] = cutoffTime.split(":").map(Number);
  const now = getVietnamNow();

  // Tạo thời điểm mục tiêu hôm nay (theo giờ VN)
  const targetToday = new Date(now);
  targetToday.setHours(targetHours, targetMinutes, 0, 0);

  let msUntil = targetToday.getTime() - now.getTime();

  if (msUntil <= 0) {
    // Đã quá giờ chốt hôm nay → hẹn cho ngày mai
    msUntil += 24 * 60 * 60 * 1000;
  }

  return msUntil;
}

/**
 * Thực hiện duyệt tự động và đồng bộ chốt suất
 */
async function executeScheduledTasks(): Promise<void> {
  const timestamp = getVietnamNow().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  console.log(`[Scheduler] ⏰ Bắt đầu duyệt tự động lúc ${timestamp}`);

  try {
    // 1. Duyệt tự động các đơn cắt suất quá hạn
    const approveResult = await autoApproveExpiredCancellations();
    console.log(
      `[Scheduler] ✅ Kết quả duyệt cắt suất: ${approveResult.success ? "Thành công" : "Lỗi"}`,
      approveResult.success
        ? `— ${(approveResult as { autoApprovedCount?: number }).autoApprovedCount ?? 0} đơn`
        : `— ${(approveResult as { error?: string }).error ?? ""}`
    );
  } catch (error) {
    console.error("[Scheduler] ❌ Lỗi khi duyệt tự động cắt suất:", error);
  }

  try {
    // 2. Đồng bộ lại bảng chốt suất cho ngày hôm nay
    const today = getVietnamTodayUTC();
    await syncDailyMealSummaryForDate(today);
    console.log("[Scheduler] ✅ Đã đồng bộ DailyMealSummary cho hôm nay");
  } catch (error) {
    console.error("[Scheduler] ❌ Lỗi khi đồng bộ DailyMealSummary:", error);
  }
}

/**
 * Lên lịch chạy cho lần tiếp theo (vòng lặp tự tái lập)
 */
async function scheduleNextRun(): Promise<void> {
  try {
    const cutoffTime = await getCutoffTime();
    const msUntil = getMillisecondsUntilCutoff(cutoffTime);

    const hoursUntil = Math.floor(msUntil / 3600000);
    const minutesUntil = Math.floor((msUntil % 3600000) / 60000);

    console.log(
      `[Scheduler] 🕐 Đã hẹn giờ: duyệt tự động lúc ${cutoffTime} ` +
      `(còn ${hoursUntil}h${minutesUntil}m)`
    );

    // Hủy timer cũ nếu còn đang chờ
    if (currentTimerId) {
      clearTimeout(currentTimerId);
    }

    currentTimerId = setTimeout(async () => {
      await executeScheduledTasks();
      // Sau khi chạy xong, lên lịch lại cho ngày mai
      await scheduleNextRun();
    }, msUntil);

    // Đảm bảo timer không ngăn process thoát khi shutdown
    if (currentTimerId && typeof currentTimerId === "object" && "unref" in currentTimerId) {
      currentTimerId.unref();
    }
  } catch (error) {
    console.error("[Scheduler] ❌ Lỗi khi lên lịch:", error);
    // Thử lại sau 5 phút nếu lỗi
    currentTimerId = setTimeout(() => scheduleNextRun(), 5 * 60 * 1000);
    if (currentTimerId && typeof currentTimerId === "object" && "unref" in currentTimerId) {
      currentTimerId.unref();
    }
  }
}

/**
 * Khởi động scheduler — Gọi 1 lần duy nhất từ instrumentation.ts
 */
export async function startScheduler(): Promise<void> {
  if (isSchedulerRunning) {
    console.log("[Scheduler] ⚠️ Scheduler đã chạy rồi, bỏ qua lần khởi tạo trùng");
    return;
  }

  isSchedulerRunning = true;
  console.log("[Scheduler] 🚀 Khởi động In-App Scheduler duyệt cắt suất tự động");

  // Kiểm tra: nếu đang đúng sau giờ chốt và chưa duyệt hôm nay → duyệt ngay
  try {
    const cutoffTime = await getCutoffTime();
    const [cutH, cutM] = cutoffTime.split(":").map(Number);
    const vnNow = getVietnamNow();

    if (vnNow.getHours() > cutH || (vnNow.getHours() === cutH && vnNow.getMinutes() >= cutM)) {
      // Đã quá giờ chốt hôm nay → duyệt ngay nếu còn đơn PENDING
      console.log(`[Scheduler] 📋 Đã quá giờ chốt ${cutoffTime}, kiểm tra duyệt bổ sung...`);
      await executeScheduledTasks();
    }
  } catch (error) {
    console.error("[Scheduler] Lỗi khi kiểm tra duyệt lần đầu:", error);
  }

  // Lên lịch cho lần chạy tiếp theo
  await scheduleNextRun();
}
