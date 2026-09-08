// API Route: Import dữ liệu từ Excel
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  parseClassExcel,
  parseStudentExcel,
  parseScheduleExcel,
  parseSpecialMealExcel,
} from "@/lib/excel";
import bcrypt from "bcryptjs";
import { MealType, BoardingStatus, UserRole } from "@prisma/client";
import { parseDateValue } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/lib/audit-log";

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

      await logAudit({
        req: request,
        userId: session.user.id,
        userName: (session.user as any).name || (session.user as any).username || "Quản trị viên",
        userRole: session.user.role,
        action: AUDIT_ACTIONS.IMPORT,
        module: AUDIT_MODULES.CLASSES,
        description: `Import Excel danh sách lớp học: ${created} lớp (File: ${file.name})`,
        metadata: { filename: file.name, count: created },
      });

      return NextResponse.json({
        message: `Đã import thành công ${created} lớp học`,
        count: created,
      });
    }

    // ==================== IMPORT HỌC SINH (UPSERT) ====================
    if (type === "student") {
      const existingClasses = await prisma.class.findMany({ select: { id: true } });
      const classIds = existingClasses.map((c) => c.id);
      
      const existingUsers = await prisma.user.findMany({ select: { username: true } });
      const existingUsernames = existingUsers.map(u => u.username);

      const result = await parseStudentExcel(buffer, classIds, existingUsernames);

      // Tra cứu các mã học sinh đã có trong hệ thống để phân loại THÊM MỚI hay CẬP NHẬT
      const studentCodes = result.data.map((r) => r.maHocSinh);
      const existingStudents = await prisma.student.findMany({
        where: { studentCode: { in: studentCodes } },
        select: { studentCode: true },
      });
      const existingCodeSet = new Set(existingStudents.map((s) => s.studentCode));

      let newCount = 0;
      let updateCount = 0;
      const enrichedData = result.data.map((row) => {
        const isUpdate = existingCodeSet.has(row.maHocSinh);
        if (isUpdate) updateCount++;
        else newCount++;
        return {
          ...row,
          isUpdate,
        };
      });

      const enrichedResult = {
        ...result,
        data: enrichedData,
        newCount,
        updateCount,
      };

      if (action === "preview") {
        return NextResponse.json(enrichedResult);
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
          const parsed = parseDateValue(row.ngaySinh);
          if (parsed) {
            birthDateVal = parsed.dateObj;
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
              mealStartDate: row.dangKyBanTru === "CO" ? new Date() : null,
              parentPhone: row.soDienThoaiPhuHuynh || null,
              birthDate: birthDateVal
            },
          });
          created++;
        }
      }

      await logAudit({
        req: request,
        userId: session.user.id,
        userName: (session.user as any).name || (session.user as any).username || "Quản trị viên",
        userRole: session.user.role,
        action: AUDIT_ACTIONS.IMPORT,
        module: AUDIT_MODULES.STUDENTS,
        description: `Import Excel danh sách học sinh: ${created} tạo mới, ${updated} cập nhật (File: ${file.name})`,
        metadata: { filename: file.name, created, updated },
      });

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

      await logAudit({
        req: request,
        userId: session.user.id,
        userName: (session.user as any).name || (session.user as any).username || "Quản trị viên",
        userRole: session.user.role,
        action: AUDIT_ACTIONS.IMPORT,
        module: AUDIT_MODULES.SCHEDULE,
        description: `Import Excel thời khóa biểu cho ${created} lớp (Tuần ${weekNumber}, năm ${year}, File: ${file.name})`,
        metadata: { filename: file.name, count: created, weekNumber, year },
      });

      return NextResponse.json({
        message: `Đã import thời khóa biểu cho ${created} lớp (Tuần ${weekNumber}, ${year})`,
        count: created,
      });
    }

    // ==================== IMPORT LỊCH ĂN ĐẶC BIỆT ====================
    if (type === "special-meal") {
      const scheduleName = formData.get("scheduleName") as string;
      const year = parseInt(formData.get("year") as string) || new Date().getFullYear();

      if (!scheduleName) {
        return NextResponse.json(
          { error: "Vui lòng nhập tên lịch đặc biệt" },
          { status: 400 }
        );
      }

      const existingClasses = await prisma.class.findMany({ select: { id: true } });
      const classIds = existingClasses.map((c) => c.id);
      const result = await parseSpecialMealExcel(buffer, year, classIds);

      // Lookup students by name + class for matching
      const allStudents = await prisma.student.findMany({
        where: { boardingStatus: "ACTIVE" },
        include: { user: { select: { fullName: true } }, class: { select: { id: true, name: true } } },
      });

      // Build lookup: normalize(fullName) + classId -> student
      // Also need to import getWeekNumber from utils for schedule check
      const studentLookup = new Map<string, { id: string; classId: string; studentCode: string }>();
      for (const s of allStudents) {
        const key = `${s.user.fullName.trim().toLowerCase()}::${s.classId}`;
        studentLookup.set(key, { id: s.id, classId: s.classId, studentCode: s.studentCode });
      }

      // Enrich data: match students, check for duplicates
      const enrichedData: any[] = [];
      const importErrors: any[] = [...result.errors];
      
      // Get existing special meals and class schedules for duplicate checking
      const existingSpecialMeals = await prisma.studentSpecialMeal.findMany({
        select: { studentId: true, date: true, scheduleName: true, shift: true },
      });
      const existingSpecialMap = new Map(
        existingSpecialMeals.map(sm => [`${sm.studentId}::${sm.date.toISOString().split('T')[0]}`, sm])
      );

      for (const row of result.data) {
        const lookupKey = `${row.hoTen.trim().toLowerCase()}::${row.maLop}`;
        // Try exact match first, then fuzzy
        let student = studentLookup.get(lookupKey);
        
        if (!student) {
          // Try case-insensitive fuzzy match
          for (const [key, val] of studentLookup) {
            const [name, cls] = key.split("::");
            if (name === row.hoTen.trim().toLowerCase() && cls === row.maLop) {
              student = val;
              break;
            }
          }
        }

        const entries = row.entries.map((entry: any) => {
          let status = "valid"; // valid, skip_class_schedule, skip_duplicate, error_no_student, error_not_active
          let note = "";

          if (!student) {
            status = "error_no_student";
            note = "Học sinh không tồn tại hoặc chưa đăng ký bán trú";
          } else {
            // Check existing special meal on same date
            const existing = existingSpecialMap.get(`${student.id}::${entry.date}`);
            if (existing && existing.scheduleName !== scheduleName) {
              status = "skip_duplicate";
              note = `Trùng lịch '${existing.scheduleName}'`;
            } else if (existing && existing.scheduleName === scheduleName) {
              status = "update";
              note = "Cập nhật ca ăn";
            }
          }

          return { ...entry, status, note, studentId: student?.id };
        });

        enrichedData.push({ ...row, studentId: student?.id, entries });
      }

      if (action === "preview") {
        return NextResponse.json({
          data: enrichedData,
          errors: importErrors,
          isValid: importErrors.length === 0,
          scheduleName,
        });
      }

      if (!result.isValid) {
        return NextResponse.json(
          { error: "Dữ liệu có lỗi, vui lòng sửa và thử lại", errors: result.errors },
          { status: 400 }
        );
      }

      // Import: upsert valid entries
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const row of enrichedData) {
        if (!row.studentId) continue;
        for (const entry of row.entries) {
          if (entry.status === "error_no_student" || entry.status === "skip_duplicate" || entry.status === "skip_class_schedule") {
            skipped++;
            continue;
          }
          if (!entry.shift || entry.shift === "NONE") continue;

          const [ey, em, ed] = entry.date.split("-").map(Number);
          const dateObj = new Date(Date.UTC(ey, em - 1, ed));

          const existing = existingSpecialMap.get(`${row.studentId}::${entry.date}`);
          
          await prisma.studentSpecialMeal.upsert({
            where: {
              studentId_date: {
                studentId: row.studentId,
                date: dateObj,
              },
            },
            update: {
              shift: entry.shift,
              scheduleName,
              source: "IMPORT",
            },
            create: {
              studentId: row.studentId,
              date: dateObj,
              shift: entry.shift,
              scheduleName,
              source: "IMPORT",
            },
          });

          if (existing) updated++;
          else created++;
        }
      }

      await logAudit({
        req: request,
        userId: session.user.id,
        userName: (session.user as any).name || (session.user as any).username || "Quản trị viên",
        userRole: session.user.role,
        action: AUDIT_ACTIONS.IMPORT,
        module: AUDIT_MODULES.SCHEDULE,
        description: `Import Excel lịch ăn đặc biệt '${scheduleName}': ${created} tạo mới, ${updated} cập nhật, ${skipped} bỏ qua (File: ${file.name})`,
        metadata: { filename: file.name, scheduleName, created, updated, skipped },
      });

      return NextResponse.json({
        message: `Hoàn tất! Tạo mới ${created}, cập nhật ${updated}, bỏ qua ${skipped} suất.`,
        created,
        updated,
        skipped,
      });
    }

    return NextResponse.json(
      { error: "Loại import không hợp lệ. Sử dụng: class, student, schedule, special-meal" },
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
