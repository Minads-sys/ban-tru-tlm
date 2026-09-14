import React from "react";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/admin/sidebar-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || !["ADMIN", "BOARDING_MANAGER", "BOARDING_STAFF", "CASHIER", "ACCOUNTANT", "KITCHEN_SECRETARY"].includes(session.user.role)) {
    redirect("/login");
  }

  // Luôn lấy quyền hạn và thông tin mới nhất từ database
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      permissions: true,
      isActive: true,
      requiresPasswordChange: true,
    },
  });

  if (!currentUser || !currentUser.isActive) {
    redirect("/login");
  }

  if (currentUser.requiresPasswordChange) {
    redirect("/force-change-password");
  }

  const userForNav = {
    id: currentUser.id,
    name: currentUser.fullName,
    username: currentUser.username,
    role: currentUser.role,
    permissions: currentUser.permissions,
  };

  return (
    <div id="admin-main-layout" className="min-h-screen bg-slate-50 print:min-h-0 print:h-auto print:bg-white">
      <SidebarNav user={userForNav} />
      <div className="flex min-h-screen flex-col md:pl-[250px] print:pl-0 print:min-h-0 print:h-auto print:block">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto print:p-0 print:max-w-none print:min-h-0 print:h-auto print:block">
          {children}
        </main>
      </div>
    </div>
  );
}
