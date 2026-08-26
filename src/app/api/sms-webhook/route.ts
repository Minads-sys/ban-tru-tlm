import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { format } from "date-fns";

// Webhook endpoint for SMS Gateway (e.g. eSMS, VMG, FPT)
// Provider sends a GET or POST request to this URL when a parent texts 81xx
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Example parameters from typical VN SMS gateways
    const sender = searchParams.get('sender') || searchParams.get('phone'); // e.g., 0987654321
    const message = searchParams.get('message') || searchParams.get('content'); // e.g., "BANTRU RESET HS001"
    
    if (!sender || !message) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const cleanMessage = message.trim().toUpperCase();
    const parts = cleanMessage.split(' ');

    if (parts.length >= 3 && parts[0] === 'BANTRU' && parts[1] === 'RESET') {
      const studentCode = parts[2];

      // 1. Find the student by studentCode and check if phone matches parentPhone
      const student = await prisma.student.findUnique({
        where: { studentCode },
        include: { user: true },
      });

      if (!student) {
        return new NextResponse("Ma hoc sinh khong ton tai trong he thong."); 
      }

      // Check phone number match (normalize phone numbers first in real app)
      // Here we do a basic check
      const normalizedSender = sender.replace(/^84/, '0'); // Convert 8498... to 098...
      
      if (!student.parentPhone || !student.parentPhone.includes(normalizedSender)) {
        return new NextResponse(`So dien thoai ${sender} khong duoc phep thuc hien yeu cau cho hoc sinh ${studentCode}. Vui long lien he GVCN.`); 
      }

      // 2. Reset password to DOB
      let newPasswordStr = "123456";
      if (student.birthDate) {
        newPasswordStr = format(new Date(student.birthDate), 'ddMMyyyy');
      }

      const newHash = await bcrypt.hash(newPasswordStr, 10);

      // 3. Update database
      await prisma.user.update({
        where: { id: student.userId },
        data: {
          passwordHash: newHash,
          requiresPasswordChange: true,
        },
      });

      // 4. Return SMS response content (Gateway will send this string back to the parent)
      // Note: SMS length should be < 160 chars without accents
      return new NextResponse(`Khoi phuc thanh cong. Mat khau cua hoc sinh ${studentCode} la ngay thang nam sinh (${newPasswordStr}). Ban se phai doi mat khau khi dang nhap. Chi tiet lien he GVCN.`);
    }

    return new NextResponse("Cu phap khong hop le. De khoi phuc mat khau, soan: BANTRU RESET <MaHocSinh>");
  } catch (error) {
    console.error("SMS Webhook Error:", error);
    return new NextResponse("He thong dang bao tri, vui long thu lai sau.");
  }
}
