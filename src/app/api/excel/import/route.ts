// API Route: Import dữ liệu từ Excel
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  parseClassExcel,
  parseStudentExcel,
  parseScheduleExcel,
} from "@/lib/excel";
import bcrypt from "bcryptjs";
import { MealType, BoardingStatus, UserRole } from "@prisma/client";

import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Chỉ Quản trị viên mới có quyền thực hiện chức năng này." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;
    const action = formData.get("action") as string; // "preview" | "import"

    if (!file || !type) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp file và loại dữ liệu" },
        { status: 400 }
      );
    }

    const buffer = new Uint8Array(await file.arrayBuffer());

    // ==================== IMPORT LỚP HỌC ====================
    if (type === "class") {
      const result = await parseClassExcel(buffer);

      if (action === "preview") {
        return NextResponse.json(result);
      }

      if (!result.isValid) {
        return NextResponse.json(
          { error: "Dữ liệu có lỗi, vui lòng sửa và thử lại", errors: result.errors },
          { status: 400 }
        );
      }

      // Import vào database
      let created = 0;
      for (const row of result.data) {
        await prisma.class.upsert({
          where: { id: row.maLop },
          update: { name: row.tenLop },
          create: {
            id: row.maLop,
            name: row.tenLop,
          },
        });
        created++;
      }

      return NextResponse.json({
        message: `Đã import thành công ${created} lớp học`,
        count: created,
      });
    }

    // ==================== IMPORT HỌC SINH (UPSERT) ====================
    if (type === "student") {
      const existingClasses = await prisma.class.findMany({ select: { id: true } });
      const classIds = existingClasses.map((c) => c.id);
      const result = await parseStudentExcel(buffer, classIds);

      if (action === "preview") {
        return NextResponse.json(result);
      }

      if (!result.isValid) {
        return NextResponse.json(
          { error: "Dữ liệu có lỗi, vui lòng sửa và thử lại", errors: result.errors },
          { status: 400 }
        );
      }

      let created = 0;
      let updated = 0;

      for (const row of result.data) {
        const passwordHash = await bcrypt.hash(row.matKhauBanDau, 10);
        
        let birthDateVal: Date | null = null;
        if (row.ngaySinh) {
          // parse ddmmyyyy if it is a string without slashes, or parsing from DD/MM/YYYY
          if (row.ngaySinh.length === 8 && !row.ngaySinh.includes("/")) {
            const d = parseInt(row.ngaySinh.substring(0,2));
            const m = parseInt(row.ngaySinh.substring(2,4)) - 1;
            const y = parseInt(row.ngaySinh.substring(4,8));
            birthDateVal = new Date(Date.UTC(y, m, d));
          } else if (row.ngaySinh.includes("/")) {
            const parts = row.ngaySinh.split("/");
            if (parts.length === 3) {
              birthDateVal = new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
            }
          }
        }

        const existingStudent = await prisma.student.findUnique({
          where: { studentCode: row.maHocSinh },
          include: { user: true }
        });

        if (existingStudent) {
          // Update User
          await prisma.user.update({
            where: { id: existingStudent.userId },
            data: {
              fullName: row.hoTen,
              passwordHash: passwordHash // Ghi đè password như yêu cầu
            }
          });

          // Update Student
          await prisma.student.update({
            where: { id: existingStudent.id },
            data: {
              classId: row.maLop,
              gender: row.gioiTinh === "NU" ? "FEMALE" : "MALE",
              mealType: row.cheDoAn as MealType,
              boardingStatus: row.dangKyBanTru === "CO" ? BoardingStatus.ACTIVE : BoardingStatus.CANCELLED,
              parentPhone: row.soDienThoaiPhuHuynh || null,
              birthDate: birthDateVal
            }
          });
          updated++;
        } else {
          // Create User
          const user = await prisma.user.create({
            data: {
              username: row.tenDangNhap,
              passwordHash,
              fullName: row.hoTen,
              role: UserRole.STUDENT,
              requiresPasswordChange: true,
            },
          });
          // Lấy boardingCode mới nhất để sinh mã tiếp theo
          const lastStudent = await prisma.student.findFirst({
            where: { boardingCode: { not: null } },
            orderBy: { boardingCode: 'desc' }
          });
          
          let nextNumber = 1;
          if (lastStudent && lastStudent.boardingCode && lastStudent.boardingCode.startsWith('BT')) {
            const lastNum = parseInt(lastStudent.boardingCode.replace('BT', ''), 10);
            if (!isNaN(lastNum)) {
              nextNumber = lastNum + 1;
            }
          }
          const boardingCode = `BT${String(nextNumber).padStart(5, '0')}`;

          // Create Student
          await prisma.student.create({
            data: {
              studentCode: row.maHocSinh,
              boardingCode: boardingCode,
              userId: user.id,
              classId: row.maLop,
              gender: row.gioiTinh === "NU" ? "FEMALE" : "MALE",
              mealType: row.cheDoAn as MealType,
              boardingStatus: row.dangKyBanTru === "CO" ? BoardingStatus.ACTIVE : BoardingStatus.CANCELLED,
              boardingRegisteredAt: row.dangKyBanTru === "CO" ? new Date() : null,
              parentPhone: row.soDienThoaiPhuHuynh || null,
              birthDate: birthDateVal
            },
          });
          created++;
        }
      }

      return NextResponse.json({
        message: `Hoàn tất! Tạo mới ${created} HS, cập nhật ${updated} HS.`,
        created,
        updated,
      });
    }

    // ==================== IMPORT THỜI KHÓA BIỂU ====================
    if (type === "schedule") {
      const weekNumber = parseInt(formData.get("weekNumber") as string) || 1;
      const year = parseInt(formData.get("year") as string) || new Date().getFullYear();
      const startDateStr = formData.get("startDate") as string;

      const existingClasses = await prisma.class.findMany({ select: { id: true } });
      const classIds = existingClasses.map((c) => c.id);
      const result = await parseScheduleExcel(buffer, classIds);

      if (action === "preview") {
        return NextResponse.json(result);
      }

      if (!result.isValid) {
        return NextResponse.json(
          { error: "Dữ liệu có lỗi, vui lòng sửa và thử lại", errors: result.errors },
          { status: 400 }
        );
      }

      let created = 0;
      for (const row of result.data) {
        await prisma.classWeeklySchedule.upsert({
          where: {
            classId_year_weekNumber: {
              classId: row.maLop,
              year,
              weekNumber,
            },
          },
          update: {
            monday: row.thu2 === "TIET_4" ? "TIET_4" : row.thu2 === "TIET_5" ? "TIET_5" : "NONE",
            tuesday: row.thu3 === "TIET_4" ? "TIET_4" : row.thu3 === "TIET_5" ? "TIET_5" : "NONE",
            wednesday: row.thu4 === "TIET_4" ? "TIET_4" : row.thu4 === "TIET_5" ? "TIET_5" : "NONE",
            thursday: row.thu5 === "TIET_4" ? "TIET_4" : row.thu5 === "TIET_5" ? "TIET_5" : "NONE",
            friday: row.thu6 === "TIET_4" ? "TIET_4" : row.thu6 === "TIET_5" ? "TIET_5" : "NONE",
            saturday: row.thu7 === "TIET_4" ? "TIET_4" : row.thu7 === "TIET_5" ? "TIET_5" : "NONE",
            note: row.ghiChu || null,
          },
          create: {
            classId: row.maLop,
            year,
            weekNumber,
            startDate: startDateStr ? new Date(startDateStr) : new Date(),
            monday: row.thu2 === "TIET_4" ? "TIET_4" : row.thu2 === "TIET_5" ? "TIET_5" : "NONE",
            tuesday: row.thu3 === "TIET_4" ? "TIET_4" : row.thu3 === "TIET_5" ? "TIET_5" : "NONE",
            wednesday: row.thu4 === "TIET_4" ? "TIET_4" : row.thu4 === "TIET_5" ? "TIET_5" : "NONE",
            thursday: row.thu5 === "TIET_4" ? "TIET_4" : row.thu5 === "TIET_5" ? "TIET_5" : "NONE",
            friday: row.thu6 === "TIET_4" ? "TIET_4" : row.thu6 === "TIET_5" ? "TIET_5" : "NONE",
            saturday: row.thu7 === "TIET_4" ? "TIET_4" : row.thu7 === "TIET_5" ? "TIET_5" : "NONE",
            note: row.ghiChu || null,
          },
        });
        created++;
      }

      return NextResponse.json({
        message: `Đã import thời khóa biểu cho ${created} lớp (Tuần ${weekNumber}, ${year})`,
        count: created,
      });
    }

    return NextResponse.json(
      { error: "Loại import không hợp lệ. Sử dụng: class, student, schedule" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Lỗi khi xử lý file import", details: String(error) },
      { status: 500 }
    );
  }
}
