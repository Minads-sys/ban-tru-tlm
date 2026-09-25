import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

// Cho phép xử lý upload lâu hơn (tối đa 30 giây mỗi batch)
export const maxDuration = 30;

// POST: Upload ảnh theo từng batch nhỏ (tối đa 5 ảnh/batch, ~2MB/batch)
// Dùng cho trường hợp tổng số ảnh lớn (>8 ảnh) vượt giới hạn 10MB body của Next.js
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

    // Parse FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (parseError) {
      console.error("Lỗi parse formData upload-photos:", parseError);
      return NextResponse.json({
        error: "Dữ liệu gửi lên quá lớn hoặc bị lỗi. Hãy giảm số lượng ảnh mỗi batch (tối đa 5 ảnh).",
      }, { status: 413 });
    }

    const deliveryDateStr = formData.get("deliveryDate") as string;
    if (!deliveryDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDateStr)) {
      return NextResponse.json({ error: "Thiếu hoặc sai định dạng deliveryDate (YYYY-MM-DD)" }, { status: 400 });
    }

    const rawFiles = formData.getAll("photos") as File[];
    const files: File[] = rawFiles.filter((f) => f && typeof f.arrayBuffer === "function");

    if (files.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy file ảnh nào trong batch" }, { status: 400 });
    }

    if (files.length > 5) {
      return NextResponse.json({ error: "Mỗi batch chỉ được tối đa 5 ảnh" }, { status: 400 });
    }

    // Kiểm tra định dạng ảnh cho phép
    const allowedTypes = ["image/webp", "image/jpeg", "image/png", "image/jpg"];
    for (const f of files) {
      if (!allowedTypes.includes(f.type)) {
        return NextResponse.json({
          error: `File "${f.name}" không hợp lệ (chỉ chấp nhận ảnh WebP, JPEG, PNG)`,
        }, { status: 400 });
      }
      if (f.size > 5 * 1024 * 1024) {
        return NextResponse.json({
          error: `File ảnh "${f.name}" vượt quá 5MB. Vui lòng nén lại trước khi gửi.`,
        }, { status: 400 });
      }
    }

    // Chuẩn bị thư mục lưu trữ: public/uploads/delivery-receipts/YYYY-MM/
    const [yearStr, monthStr, dayStr] = deliveryDateStr.split("-");
    const subFolder = `${yearStr}-${monthStr.padStart(2, "0")}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "delivery-receipts", subFolder);

    await fs.mkdir(uploadDir, { recursive: true });

    // Lưu tuần tự từng file ảnh
    const photoUrls: string[] = [];
    const savedFilePaths: string[] = [];
    let totalPhotoSizeKb = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = f.type === "image/webp" ? "webp" : f.type === "image/png" ? "png" : "jpg";
        const randomSuffix = crypto.randomBytes(6).toString("hex");
        const fileName = `receipt_${yearStr}${monthStr}${dayStr}_${Date.now()}_${i + 1}_${randomSuffix}.${ext}`;
        const filePath = path.join(uploadDir, fileName);

        const arrayBuffer = await f.arrayBuffer();
        await fs.writeFile(filePath, Buffer.from(arrayBuffer));

        savedFilePaths.push(filePath);
        photoUrls.push(`/uploads/delivery-receipts/${subFolder}/${fileName}`);
        totalPhotoSizeKb += Math.round(f.size / 1024);
      }
    } catch (fileError) {
      // Cleanup: Xóa các file đã lưu nếu quá trình ghi file bị lỗi giữa chừng
      console.error(`Lỗi khi ghi file ảnh batch (đã lưu ${savedFilePaths.length}/${files.length} file):`, fileError);
      for (const fp of savedFilePaths) {
        try { await fs.unlink(fp); } catch { /* bỏ qua */ }
      }
      return NextResponse.json({
        error: `Lỗi khi lưu ảnh lên máy chủ (ảnh thứ ${savedFilePaths.length + 1}/${files.length}). Vui lòng thử lại.`,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      photoUrls,
      photoSizeKb: totalPhotoSizeKb,
    });
  } catch (error) {
    console.error("Lỗi upload-photos batch:", error);
    const errMsg = String(error);
    if (errMsg.includes("PAYLOAD_TOO_LARGE") || errMsg.includes("body exceeded") || errMsg.includes("entity too large")) {
      return NextResponse.json({
        error: "Batch ảnh quá lớn. Hãy giảm số lượng ảnh mỗi batch rồi thử lại.",
      }, { status: 413 });
    }
    return NextResponse.json({ error: "Lỗi máy chủ khi upload batch ảnh", details: errMsg }, { status: 500 });
  }
}
