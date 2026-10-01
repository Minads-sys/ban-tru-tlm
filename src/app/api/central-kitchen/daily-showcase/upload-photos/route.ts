import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const userPerms = session.user.permissions || [];
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "BOARDING_MANAGER";
    const canManage = hasPermission(userPerms, "MANAGE_KITCHEN") || isAdmin;

    if (!canManage) {
      return NextResponse.json({ error: "Không có quyền tải ảnh suất ăn" }, { status: 403 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (parseError) {
      console.error("Lỗi parse formData upload ảnh suất ăn:", parseError);
      return NextResponse.json({ error: "Dữ liệu tải lên không hợp lệ hoặc quá lớn" }, { status: 413 });
    }

    const dateStr = (formData.get("date") as string) || new Date().toISOString().split("T")[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: "Định dạng ngày không hợp lệ (YYYY-MM-DD)" }, { status: 400 });
    }

    const rawFiles = formData.getAll("photos") as File[];
    const files: File[] = rawFiles.filter((f) => f && typeof f.arrayBuffer === "function");

    if (files.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy file ảnh nào" }, { status: 400 });
    }

    if (files.length > 3) {
      return NextResponse.json({ error: "Tối đa chỉ được tải lên 3 ảnh suất ăn mỗi ngày" }, { status: 400 });
    }

    const allowedTypes = ["image/webp", "image/jpeg", "image/png", "image/jpg"];
    for (const f of files) {
      if (!allowedTypes.includes(f.type)) {
        return NextResponse.json({
          error: `File "${f.name}" không hợp lệ. Chỉ chấp nhận ảnh WebP, JPEG, PNG.`,
        }, { status: 400 });
      }
      if (f.size > 10 * 1024 * 1024) {
        return NextResponse.json({
          error: `File ảnh "${f.name}" vượt quá 10MB. Vui lòng giảm dung lượng trước khi gửi.`,
        }, { status: 400 });
      }
    }

    // Thư mục lưu trữ: public/uploads/daily-meals/YYYY-MM/
    const [yearStr, monthStr, dayStr] = dateStr.split("-");
    const subFolder = `${yearStr}-${monthStr.padStart(2, "0")}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "daily-meals", subFolder);

    await fs.mkdir(uploadDir, { recursive: true });

    const photoUrls: string[] = [];
    const savedFilePaths: string[] = [];
    let totalPhotoSizeKb = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = f.type === "image/webp" ? "webp" : f.type === "image/png" ? "png" : "jpg";
        const randomSuffix = crypto.randomBytes(4).toString("hex");
        const fileName = `meal_${yearStr}${monthStr}${dayStr}_${Date.now()}_${i + 1}_${randomSuffix}.${ext}`;
        const filePath = path.join(uploadDir, fileName);

        const arrayBuffer = await f.arrayBuffer();
        await fs.writeFile(filePath, Buffer.from(arrayBuffer));

        savedFilePaths.push(filePath);
        photoUrls.push(`/uploads/daily-meals/${subFolder}/${fileName}`);
        totalPhotoSizeKb += Math.round(f.size / 1024);
      }
    } catch (fileError) {
      console.error("Lỗi ghi file ảnh suất ăn:", fileError);
      for (const fp of savedFilePaths) {
        try { await fs.unlink(fp); } catch { /* ignore */ }
      }
      return NextResponse.json({ error: "Lỗi máy chủ khi lưu file ảnh. Vui lòng thử lại." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      photoUrls,
      totalPhotoSizeKb,
    });
  } catch (error) {
    console.error("Lỗi upload ảnh suất ăn:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi upload ảnh", details: String(error) }, { status: 500 });
  }
}
