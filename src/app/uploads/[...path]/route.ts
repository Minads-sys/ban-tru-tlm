import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const pathSegments = resolvedParams.path;

    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Chống Directory Traversal attack
    const safeSubPath = path.normalize(pathSegments.join("/")).replace(/^(\.\.[\/\\])+/, "");
    if (safeSubPath.includes("..")) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const fullPath = path.join(process.cwd(), "public", "uploads", safeSubPath);

    if (!existsSync(fullPath)) {
      return new NextResponse("File Not Found", { status: 404 });
    }

    const fileBuffer = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();

    let contentType = "application/octet-stream";
    if (ext === ".webp") contentType = "image/webp";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".png") contentType = "image/png";
    else if (ext === ".svg") contentType = "image/svg+xml";
    else if (ext === ".pdf") contentType = "application/pdf";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Lỗi khi đọc file upload:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
