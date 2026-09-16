import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { removeVietnameseTones } from "@/lib/utils";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES, getClientIp } from "@/lib/audit-log";

// In-memory rate limiting map
// Key: ip + ":" + cccd
interface RateLimitEntry {
  count: number;
  lockedUntil?: number;
  firstAttempt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 phút
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(key: string): { allowed: boolean; waitMinutes?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry) return { allowed: true };

  if (entry.lockedUntil && entry.lockedUntil > now) {
    const remainingMs = entry.lockedUntil - now;
    return { allowed: false, waitMinutes: Math.ceil(remainingMs / 60000) };
  }

  // Reset window if expired
  if (now - entry.firstAttempt > WINDOW_MS) {
    rateLimitMap.delete(key);
    return { allowed: true };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
    return { allowed: false, waitMinutes: 15 };
  }

  return { allowed: true };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry) {
    rateLimitMap.set(key, { count: 1, firstAttempt: now });
  } else {
    entry.count += 1;
    if (entry.count >= MAX_ATTEMPTS) {
      entry.lockedUntil = now + LOCKOUT_MS;
    }
  }
}

function clearRateLimit(key: string) {
  rateLimitMap.delete(key);
}

// Helper: Phân tích các định dạng ngày sinh đầu vào (YYYY-MM-DD, DD/MM/YYYY, DDMMYYYY)
function parseInputDate(str: string): { day: number; month: number; year: number } | null {
  if (!str) return null;
  const s = str.trim();

  // YYYY-MM-DD (từ thẻ <input type="date" />)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return { day: d, month: m, year: y };
  }

  // DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/").map(Number);
    return { day: d, month: m, year: y };
  }

  // DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split("-").map(Number);
    return { day: d, month: m, year: y };
  }

  // DDMMYYYY (8 số liền nhau)
  if (/^\d{8}$/.test(s)) {
    const d = Number(s.slice(0, 2));
    const m = Number(s.slice(2, 4));
    const y = Number(s.slice(4, 8));
    return { day: d, month: m, year: y };
  }

  return null;
}

// Helper: Chuẩn hóa số điện thoại (bỏ ký tự lạ, chuẩn hóa +84/84 về 0)
function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("84") && p.length > 9) {
    p = "0" + p.slice(2);
  }
  return p;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fullName, cccd, birthDate, parentPhone } = body || {};

    if (!fullName || !cccd || !birthDate || !parentPhone) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ 4 thông tin: Họ tên, Số CCCD, Ngày sinh và Số điện thoại phụ huynh." },
        { status: 400 }
      );
    }

    const ip = getClientIp(req) || "unknown_ip";
    const cleanCCCD = String(cccd).replace(/\D/g, "");

    if (cleanCCCD.length < 6) {
      return NextResponse.json(
        { error: "Số CCCD không hợp lệ. Vui lòng kiểm tra lại." },
        { status: 400 }
      );
    }

    const rateKey = `${ip}:${cleanCCCD}`;
    const rateCheck = checkRateLimit(rateKey);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Bạn đã nhập sai thông tin quá số lần quy định. Vui lòng thử lại sau ${rateCheck.waitMinutes || 15} phút hoặc liên hệ Giáo viên chủ nhiệm để được hỗ trợ.`,
        },
        { status: 429 }
      );
    }

    const parsedBirth = parseInputDate(String(birthDate));
    if (!parsedBirth) {
      return NextResponse.json(
        { error: "Định dạng ngày sinh không hợp lệ. Vui lòng chọn hoặc nhập dạng ngày/tháng/năm." },
        { status: 400 }
      );
    }

    // Chuẩn hóa CCCD 11 số / 12 số:
    // 12 số chuẩn: padStart(12, '0')
    // 11 số (nếu mất số 0 đầu): cleanCCCD hoặc cleanCCCD.replace(/^0+/, '')
    const cccd12 = cleanCCCD.padStart(12, "0");
    const cccdTrimmed = cleanCCCD.replace(/^0+/, "");

    // 1. Tìm các học sinh phù hợp với mã CCCD (chấp nhận cả 11 và 12 số)
    const matchingStudents = await prisma.student.findMany({
      where: {
        OR: [
          { studentCode: cleanCCCD },
          { studentCode: cccd12 },
          { studentCode: cccdTrimmed },
        ],
      },
      include: {
        user: true,
        class: true,
      },
    });

    if (matchingStudents.length === 0) {
      recordFailedAttempt(rateKey);
      return NextResponse.json(
        {
          error: "Thông tin xác thực không khớp với hồ sơ lưu tại nhà trường. Vui lòng kiểm tra lại Họ tên, CCCD, Ngày sinh và Số điện thoại phụ huynh.",
        },
        { status: 400 }
      );
    }

    // 2. Đối soát Họ và Tên (chuẩn hóa bỏ dấu, bỏ khoảng trắng, chữ thường)
    const normalizedInputName = removeVietnameseTones(String(fullName))
      .replace(/\s+/g, "")
      .toLowerCase();

    const studentWithNameMatch = matchingStudents.filter((s) => {
      const studentNameNormalized = removeVietnameseTones(s.user.fullName || "")
        .replace(/\s+/g, "")
        .toLowerCase();
      return studentNameNormalized === normalizedInputName;
    });

    if (studentWithNameMatch.length === 0) {
      recordFailedAttempt(rateKey);
      return NextResponse.json(
        {
          error: "Thông tin xác thực không khớp với hồ sơ lưu tại nhà trường. Vui lòng kiểm tra lại Họ tên, CCCD, Ngày sinh và Số điện thoại phụ huynh.",
        },
        { status: 400 }
      );
    }

    // 3. Đối soát Ngày tháng năm sinh & Số điện thoại phụ huynh
    const normalizedInputPhone = normalizePhone(String(parentPhone));

    const matchedStudent = studentWithNameMatch.find((s) => {
      // Kiểm tra ngày sinh (dùng UTC để tránh lệch múi giờ trên server)
      if (!s.birthDate) return false;
      const dbDate = new Date(s.birthDate);
      const dbDay = dbDate.getUTCDate();
      const dbMonth = dbDate.getUTCMonth() + 1;
      const dbYear = dbDate.getUTCFullYear();

      const birthMatch =
        dbDay === parsedBirth.day &&
        dbMonth === parsedBirth.month &&
        dbYear === parsedBirth.year;

      if (!birthMatch) return false;

      // Kiểm tra số điện thoại phụ huynh
      const dbPhoneNormalized = normalizePhone(s.parentPhone);
      const phoneMatch = dbPhoneNormalized === normalizedInputPhone;

      return phoneMatch;
    });

    if (!matchedStudent) {
      recordFailedAttempt(rateKey);
      return NextResponse.json(
        {
          error: "Thông tin xác thực không khớp với hồ sơ lưu tại nhà trường. Vui lòng kiểm tra lại Họ tên, CCCD, Ngày sinh và Số điện thoại phụ huynh.",
        },
        { status: 400 }
      );
    }

    // 4. Khôi phục mật khẩu về Ngày tháng năm sinh mặc định (ddmmyyyy)
    const dbDate = new Date(matchedStudent.birthDate!);
    const dayStr = String(dbDate.getUTCDate()).padStart(2, "0");
    const monthStr = String(dbDate.getUTCMonth() + 1).padStart(2, "0");
    const yearStr = String(dbDate.getUTCFullYear());
    const defaultPasswordStr = `${dayStr}${monthStr}${yearStr}`;

    const newHash = await bcrypt.hash(defaultPasswordStr, 10);

    await prisma.user.update({
      where: { id: matchedStudent.userId },
      data: {
        passwordHash: newHash,
        requiresPasswordChange: true,
        passwordChangedAt: null,
      },
    });

    // Xóa bộ đếm sai khi thành công
    clearRateLimit(rateKey);

    // Ghi nhật ký hệ thống
    await logAudit({
      req,
      userId: matchedStudent.userId,
      userName: matchedStudent.user.fullName,
      userRole: "STUDENT",
      action: AUDIT_ACTIONS.RESET,
      module: AUDIT_MODULES.AUTH,
      description: `Học sinh ${matchedStudent.user.fullName} (${matchedStudent.user.username}, Lớp ${matchedStudent.classId}) tự khôi phục mật khẩu mặc định qua đối soát thông tin chéo.`,
      targetId: matchedStudent.id,
      metadata: {
        studentCode: matchedStudent.studentCode,
        classId: matchedStudent.classId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Khôi phục mật khẩu thành công!",
      studentName: matchedStudent.user.fullName,
      username: matchedStudent.user.username,
      classId: matchedStudent.classId,
    });
  } catch (error) {
    console.error("Student forgot password error:", error);
    return NextResponse.json(
      { error: "Đã có lỗi xảy ra trong quá trình xử lý. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
