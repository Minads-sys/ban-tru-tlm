import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/lib/audit-log";
import { prismaExcludeTestClasses } from "@/lib/test-classes";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

// GET: Lấy danh sách phiếu giao nhận hoặc số suất kế hoạch đối chiếu
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const userPerms = session.user.permissions || [];
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "BOARDING_MANAGER";
    const canDeliver = hasPermission(userPerms, "DELIVER_MEALS") || isAdmin;

    if (!canDeliver) {
      return NextResponse.json({ error: "Không có quyền truy cập tính năng giao nhận" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Lấy số suất kế hoạch của ngày để nhân viên giao nhận đối chiếu
    if (action === "expected-summary") {
      const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
      const [y, m, d] = dateStr.split("-").map(Number);
      const targetDate = new Date(Date.UTC(y, m - 1, d));

      // Lấy từ bảng DailyMealSummary nếu đã chốt
      const summaries = await prisma.dailyMealSummary.findMany({
        where: { summaryDate: targetDate, classId: prismaExcludeTestClasses },
      });

      let expectedMan = 0;
      let expectedChay = 0;
      let expectedChao = 0;

      if (summaries.length > 0) {
        for (const s of summaries) {
          expectedMan += s.finalMan || s.expectedMan || 0;
          expectedChay += s.finalChay || s.expectedChay || 0;
          expectedChao += s.finalChao || s.expectedChao || 0;
        }
      } else {
        // Nếu chưa chốt DailyMealSummary, tính từ học sinh ACTIVE của các lớp có TKB ngày này
        const dayOfWeek = targetDate.getUTCDay();
        const dayFieldMap: Record<number, string> = {
          1: "monday", 2: "tuesday", 3: "wednesday",
          4: "thursday", 5: "friday", 6: "saturday",
        };
        const dayField = dayFieldMap[dayOfWeek];

        if (dayField) {
          // Lấy tất cả lớp có lịch ăn
          const activeSchedules = await prisma.classWeeklySchedule.findMany({
            where: {
              year: y,
              [dayField]: { not: "NONE" },
              classId: prismaExcludeTestClasses,
            },
            select: { classId: true },
          });
          const classIds = activeSchedules.map((s) => s.classId);

          if (classIds.length > 0) {
            const students = await prisma.student.findMany({
              where: {
                classId: { in: classIds },
                boardingStatus: "ACTIVE",
              },
              select: { mealType: true },
            });
            for (const st of students) {
              if (st.mealType === "CHAY") expectedChay++;
              else if (st.mealType === "CHAO") expectedChao++;
              else expectedMan++;
            }
          }
        }
      }

      return NextResponse.json({
        date: dateStr,
        expectedMan,
        expectedChay,
        expectedChao,
        expectedTotal: expectedMan + expectedChay + expectedChao,
      });
    }

    // Danh sách phiếu giao nhận
    const dateStr = searchParams.get("date");
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : null;
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : null;
    const limit = parseInt(searchParams.get("limit") || "60");

    const where: any = {};

    if (dateStr) {
      const [y, m, d] = dateStr.split("-").map(Number);
      where.deliveryDate = new Date(Date.UTC(y, m - 1, d));
    } else if (month && year) {
      const firstDay = new Date(Date.UTC(year, month - 1, 1));
      const lastDay = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      where.deliveryDate = { gte: firstDay, lte: lastDay };
    }

    // Nếu không phải admin, chỉ xem phiếu của mình (hoặc cho xem tất cả phiếu giao nhận)
    // Để tiện đối soát trong ca, cho phép nhân viên có quyền DELIVER_MEALS xem danh sách phiếu giao nhận
    const records = await prisma.mealDeliveryRecord.findMany({
      where,
      orderBy: [{ deliveryDate: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        deliveredBy: {
          select: { id: true, fullName: true, username: true },
        },
      },
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error("Lỗi lấy danh sách giao nhận:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi lấy dữ liệu giao nhận" }, { status: 500 });
  }
}

// POST: Tạo phiếu giao nhận mới kèm upload ảnh ký nhận đã nén
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const userPerms = session.user.permissions || [];
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "BOARDING_MANAGER";
    const canDeliver = hasPermission(userPerms, "DELIVER_MEALS") || isAdmin;

    if (!canDeliver) {
      return NextResponse.json({ error: "Không có quyền thực hiện giao nhận suất cơm" }, { status: 403 });
    }

    const formData = await request.formData();
    const deliveryDateStr = formData.get("deliveryDate") as string;
    const shift = (formData.get("shift") as string) || "ALL";
    const receiverName = ((formData.get("receiverName") as string) || "").trim();
    const receiverPhone = ((formData.get("receiverPhone") as string) || "").trim();
    const note = ((formData.get("note") as string) || "").trim();

    const deliveredMan = parseInt(formData.get("deliveredMan") as string) || 0;
    const deliveredChay = parseInt(formData.get("deliveredChay") as string) || 0;
    const deliveredChao = parseInt(formData.get("deliveredChao") as string) || 0;
    const totalDelivered = deliveredMan + deliveredChay + deliveredChao;
    const expectedTotal = formData.get("expectedTotal")
      ? parseInt(formData.get("expectedTotal") as string)
      : null;

    const rawFiles = formData.getAll("photos") as File[];
    const singleFile = formData.get("photo") as File | null;
    const files: File[] = rawFiles.length > 0 ? rawFiles : singleFile ? [singleFile] : [];

    if (!deliveryDateStr) {
      return NextResponse.json({ error: "Vui lòng chọn ngày giao nhận" }, { status: 400 });
    }

    if (!receiverName) {
      return NextResponse.json({ error: "Vui lòng nhập tên người ký nhận cơm" }, { status: 400 });
    }

    if (totalDelivered <= 0) {
      return NextResponse.json({ error: "Tổng số suất cơm giao phải lớn hơn 0" }, { status: 400 });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "Vui lòng chụp ảnh hoặc tải lên ít nhất 1 ảnh phiếu ký nhận" }, { status: 400 });
    }

    if (files.length > 40) {
      return NextResponse.json({ error: "Tối đa chỉ được tải lên 40 ảnh cho một phiếu giao nhận" }, { status: 400 });
    }

    // Kiểm tra định dạng ảnh cho phép
    const allowedTypes = ["image/webp", "image/jpeg", "image/png", "image/jpg"];
    for (const f of files) {
      if (!allowedTypes.includes(f.type)) {
        return NextResponse.json({ error: `File "${f.name}" không hợp lệ (chỉ chấp nhận ảnh WebP, JPEG, PNG)` }, { status: 400 });
      }
      if (f.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: `File ảnh "${f.name}" vượt quá 5MB. Vui lòng nén lại trước khi gửi.` }, { status: 400 });
      }
    }

    // Chuẩn bị thư mục lưu trữ: public/uploads/delivery-receipts/YYYY-MM/
    const [yearStr, monthStr, dayStr] = deliveryDateStr.split("-");
    const subFolder = `${yearStr}-${monthStr.padStart(2, "0")}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "delivery-receipts", subFolder);

    await fs.mkdir(uploadDir, { recursive: true });

    // Lưu tuần tự từng file ảnh đã nén xuống ổ cứng (mỗi file chỉ ~150-200KB)
    const photoUrls: string[] = [];
    let totalPhotoSizeKb = 0;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = f.type === "image/webp" ? "webp" : f.type === "image/png" ? "png" : "jpg";
      const randomSuffix = crypto.randomBytes(6).toString("hex");
      const fileName = `receipt_${yearStr}${monthStr}${dayStr}_${Date.now()}_${i + 1}_${randomSuffix}.${ext}`;
      const filePath = path.join(uploadDir, fileName);

      const arrayBuffer = await f.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(arrayBuffer));

      photoUrls.push(`/uploads/delivery-receipts/${subFolder}/${fileName}`);
      totalPhotoSizeKb += Math.round(f.size / 1024);
    }

    // Lưu bản ghi vào CSDL
    const [y, m, d] = deliveryDateStr.split("-").map(Number);
    const deliveryDate = new Date(Date.UTC(y, m - 1, d));

    const record = await prisma.mealDeliveryRecord.create({
      data: {
        deliveryDate,
        shift,
        receiverName,
        receiverPhone: receiverPhone || null,
        deliveredMan,
        deliveredChay,
        deliveredChao,
        totalDelivered,
        expectedTotal,
        photoUrl: photoUrls[0],
        photoUrls,
        photoSizeKb: totalPhotoSizeKb,
        deliveredById: session.user.id,
        note: note || null,
      },
      include: {
        deliveredBy: {
          select: { id: true, fullName: true, username: true },
        },
      },
    });

    logAudit({
      userId: session.user.id,
      userName: session.user.name || (session.user as any)?.username || "",
      userRole: session.user.role,
      action: AUDIT_ACTIONS.CREATE,
      module: AUDIT_MODULES.MEALS,
      description: `Giao nhận ${totalDelivered} suất cơm ngày ${deliveryDateStr} (Mặn: ${deliveredMan}, Chay: ${deliveredChay}, Cháo: ${deliveredChao}). Người nhận: ${receiverName}`,
    });

    return NextResponse.json({
      success: true,
      message: "Đã lưu phiếu giao nhận và upload ảnh ký nhận thành công!",
      record,
    });
  } catch (error) {
    console.error("Lỗi khi tạo phiếu giao nhận:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi lưu phiếu giao nhận", details: String(error) }, { status: 500 });
  }
}

// DELETE: Xóa phiếu giao nhận (Dành cho Admin hoặc người đã tạo trong ngày)
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Thiếu mã phiếu id" }, { status: 400 });
    }

    const record = await prisma.mealDeliveryRecord.findUnique({
      where: { id },
    });

    if (!record) {
      return NextResponse.json({ error: "Không tìm thấy phiếu giao nhận" }, { status: 404 });
    }

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "BOARDING_MANAGER";
    const isOwner = record.deliveredById === session.user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Bạn không có quyền xóa phiếu giao nhận này" }, { status: 403 });
    }

    // Xóa tất cả file ảnh trên đĩa nếu tồn tại
    const urlsToDelete = Array.from(new Set([...(record.photoUrls || []), record.photoUrl].filter(Boolean)));
    for (const url of urlsToDelete) {
      if (url.startsWith("/uploads/")) {
        try {
          const fullLocalPath = path.join(process.cwd(), "public", url);
          await fs.unlink(fullLocalPath);
        } catch (e) {
          // Bỏ qua lỗi nếu file không tồn tại trên đĩa
        }
      }
    }

    await prisma.mealDeliveryRecord.delete({
      where: { id },
    });

    logAudit({
      userId: session.user.id,
      userName: session.user.name || (session.user as any)?.username || "",
      userRole: session.user.role,
      action: AUDIT_ACTIONS.DELETE,
      module: AUDIT_MODULES.MEALS,
      description: `Xóa phiếu giao nhận ${record.totalDelivered} suất ngày ${record.deliveryDate.toISOString().split("T")[0]} của người nhận ${record.receiverName}`,
    });

    return NextResponse.json({ success: true, message: "Đã xóa phiếu giao nhận thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa phiếu giao nhận:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi xóa phiếu giao nhận" }, { status: 500 });
  }
}
