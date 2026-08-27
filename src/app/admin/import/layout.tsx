import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ImportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Chỉ cho phép ADMIN truy cập
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  return <>{children}</>;
}
