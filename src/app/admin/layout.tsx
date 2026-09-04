import React from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/admin/sidebar-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || !["ADMIN", "BOARDING_MANAGER", "BOARDING_STAFF", "CASHIER"].includes(session.user.role)) {
    redirect("/login");
  }

  if (session.user.requiresPasswordChange) {
    redirect("/force-change-password");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SidebarNav user={session.user} />
      <div className="flex min-h-screen flex-col md:pl-[250px] print:pl-0">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto print:p-0 print:max-w-none">
          {children}
        </main>
      </div>
    </div>
  );
}
