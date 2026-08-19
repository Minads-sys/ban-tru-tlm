import prisma from "@/lib/db";
import StudentLoginForm from "./student-login-form";

export const metadata = {
  title: "Đăng nhập Học sinh - BAN-TRU-TLM",
  description: "Đăng nhập dành cho Phụ huynh và Học sinh",
};

export default async function StudentLoginPage() {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "SCHOOL_NAME" },
  });
  const schoolName = setting?.value || "TRƯỜNG TIỂU HỌC TLM";

  return <StudentLoginForm schoolName={schoolName} />;
}
