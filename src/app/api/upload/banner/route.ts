import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "BOARDING_MANAGER";
    if (!isAdmin) {
      return NextResponse.json({ error: "Chỉ quản trị viên mới có quyền tải lên banner" }, { status: 403 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (parseError) {
      console.error("Lỗi parse formData banner upload:", parseError);
      return NextResponse.json(
        { error: "Dữ liệu gửi lên không hợp lệ hoặc kích thước quá lớn" },
        { status: 400 }
      );
    }

    const file = formData.get("banner") as File | null;
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Vui lòng chọn file hình ảnh banner" }, { status: 400 });
    }

    const allowedTypes = ["image/webp", "image/jpeg", "image/png", "image/jpg", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "File không hợp lệ. Chỉ chấp nhận định dạng ảnh WebP, JPEG, PNG, GIF" },
        { status: 400 }
      );
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Kích thước ảnh vượt quá 8MB. Vui lòng nén nhỏ hơn trước khi tải lên" },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "banners");
    await fs.mkdir(uploadDir, { recursive: true });

    const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : file.type === "image/gif" ? "gif" : "jpg";
    const randomSuffix = crypto.randomBytes(6).toString("hex");
    const fileName = `banner_${Date.now()}_${randomSuffix}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    const bannerUrl = `/uploads/banners/${fileName}`;

    return NextResponse.json({
      success: true,
      url: bannerUrl,
      fileName,
    });
  } catch (error) {
    console.error("Lỗi upload banner:", error);
    return NextResponse.json(
      { error: "Không thể lưu ảnh banner lên máy chủ. Vui lòng thử lại" },
      { status: 500 }
    );
  }
}
