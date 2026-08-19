import React from "react";
import Link from "next/link";
import prisma from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  School,
  ChefHat,
  ClipboardCheck,
  CalendarDays,
  Receipt,
  FileSpreadsheet,
  BarChart3,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

export const revalidate = 0; // Dynamic server component

export default async function AdminDashboardPage() {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );

  // Fetch all stats concurrently
  const [
    totalActiveStudents,
    totalClasses,
    pendingCancellationsCount,
    todaySummaries,
    recentPendingCancellations,
  ] = await Promise.all([
    prisma.student.count({
      where: {
        boardingStatus: "ACTIVE",
      },
    }),
    prisma.class.count(),
    prisma.mealCancellation.count({
      where: {
        status: "PENDING",
      },
    }),
    prisma.dailyMealSummary.findMany({
      where: {
        summaryDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      include: {
        class: true,
      },
    }),
    prisma.mealCancellation.findMany({
      where: {
        status: "PENDING",
      },
      include: {
        student: {
          include: {
            user: true,
            class: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    }),
  ]);

  // Calculate today's meal stats
  const totalTodayMeals = todaySummaries.reduce(
    (acc, curr) => acc + curr.finalMan + curr.finalChay + curr.finalChao,
    0
  );
  const lockedCount = todaySummaries.filter((s) => s.isLocked).length;
  const isLockedToday = todaySummaries.length > 0 && lockedCount === todaySummaries.length;

  const todayMealsDisplay =
    todaySummaries.length === 0 || totalTodayMeals === 0
      ? "Chưa chốt"
      : totalTodayMeals.toLocaleString("vi-VN");

  const todayFormatted = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Trang tổng quan
          </h1>
          <p className="text-sm text-slate-500 capitalize">
            {todayFormatted} • Hệ thống quản lý suất ăn bán trú
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
            <Link href="/admin/daily-meals" className="flex items-center gap-1.5">
              <ChefHat className="h-4 w-4" />
              <span>Chốt suất ăn hôm nay</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-slate-300">
            <Link href="/admin/import" className="flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4" />
              <span>Nhập Excel</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* 4 Stat Cards in a Grid (2x2 on mobile, 4 cols on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {/* Stat Card 1: Tổng học sinh bán trú */}
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-slate-600">
              Tổng học sinh bán trú
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-3xl font-bold text-slate-900">
              {totalActiveStudents.toLocaleString("vi-VN")}
            </div>
            <p className="mt-1 text-[11px] sm:text-xs text-emerald-600 flex items-center gap-1 font-medium">
              <TrendingUp className="h-3 w-3" />
              Đang tham gia bán trú
            </p>
          </CardContent>
        </Card>

        {/* Stat Card 2: Tổng lớp học */}
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-slate-600">
              Tổng lớp học
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <School className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-3xl font-bold text-slate-900">
              {totalClasses.toLocaleString("vi-VN")}
            </div>
            <p className="mt-1 text-[11px] sm:text-xs text-slate-500 font-medium">
              Toàn bộ các khối lớp
            </p>
          </CardContent>
        </Card>

        {/* Stat Card 3: Suất ăn hôm nay */}
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-slate-600">
              Suất ăn hôm nay
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <ChefHat className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-3xl font-bold text-slate-900 truncate">
              {todayMealsDisplay}
            </div>
            <p className="mt-1 text-[11px] sm:text-xs font-medium text-slate-500">
              {todaySummaries.length > 0
                ? isLockedToday
                  ? "✓ Đã chốt toàn bộ"
                  : `Đã chốt ${lockedCount}/${todaySummaries.length} lớp`
                : "Chưa cập nhật hôm nay"}
            </p>
          </CardContent>
        </Card>

        {/* Stat Card 4: Yêu cầu chờ duyệt */}
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-slate-600">
              Yêu cầu chờ duyệt
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <ClipboardCheck className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-3xl font-bold text-slate-900">
              {pendingCancellationsCount.toLocaleString("vi-VN")}
            </div>
            <p className="mt-1 text-[11px] sm:text-xs font-medium text-rose-600 flex items-center gap-1">
              {pendingCancellationsCount > 0 ? (
                <>
                  <AlertCircle className="h-3 w-3" />
                  Cần xử lý cắt suất ăn
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span className="text-emerald-600">Không có đơn chờ</span>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Sections: Quick Actions & Pending Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Cancellations List */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between p-5 pb-3">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Đơn báo cắt suất ăn chờ duyệt
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Các yêu cầu nghỉ ăn bán trú từ phụ huynh / học sinh
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 text-xs">
              <Link href="/admin/meal-cancel" className="flex items-center gap-1">
                Xem tất cả ({pendingCancellationsCount})
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {recentPendingCancellations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                <p className="text-sm font-medium text-slate-700">Không có yêu cầu nào đang chờ duyệt</p>
                <p className="text-xs text-slate-400 mt-0.5">Tất cả các đơn xin cắt suất ăn đã được xử lý</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentPendingCancellations.map((item) => {
                  const cancelDateStr = new Date(item.cancelDate).toLocaleDateString("vi-VN");
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-3 hover:bg-slate-50/80 rounded-lg px-2 transition-colors"
                    >
                      <div className="space-y-1 min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900 truncate">
                            {item.student.user.fullName}
                          </span>
                          <Badge variant="outline" className="text-[11px] font-normal bg-slate-100">
                            Lớp {item.student.classId}
                          </Badge>
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-[10px]">
                            Chờ duyệt
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1 text-slate-600 font-medium">
                            <Clock className="h-3 w-3 text-slate-400" />
                            Ngày nghỉ: {cancelDateStr}
                          </span>
                          <span className="truncate italic">Lý do: &quot;{item.reason}&quot;</span>
                        </div>
                      </div>

                      <Button asChild size="sm" variant="outline" className="shrink-0 h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50">
                        <Link href="/admin/meal-cancel">
                          Duyệt
                        </Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Navigation / Feature Shortcuts */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">
              Lối tắt tác vụ
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Truy cập nhanh các chức năng chính của quản trị
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-2">
            <Link
              href="/admin/daily-meals"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-blue-50/60 hover:border-blue-200 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 text-amber-700 group-hover:bg-amber-200 transition-colors">
                  <ChefHat className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-900">
                    Chốt suất ăn theo ngày
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Khóa danh sách gửi nhà bếp
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </Link>

            <Link
              href="/admin/schedule"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-blue-50/60 hover:border-blue-200 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-700 group-hover:bg-blue-200 transition-colors">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-900">
                    Thời khóa biểu bán trú
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Cấu hình lịch ăn theo tuần
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </Link>

            <Link
              href="/admin/billing"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-blue-50/60 hover:border-blue-200 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200 transition-colors">
                  <Receipt className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-900">
                    Hóa đơn & Thanh toán
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Tính tiền ăn & quản lý giao dịch
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </Link>

            <Link
              href="/admin/import"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-blue-50/60 hover:border-blue-200 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-100 text-purple-700 group-hover:bg-purple-200 transition-colors">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-900">
                    Nhập dữ liệu Excel
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Import học sinh & tài khoản
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </Link>

            <Link
              href="/admin/reports"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-blue-50/60 hover:border-blue-200 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-100 text-sky-700 group-hover:bg-sky-200 transition-colors">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-900">
                    Báo cáo & Thống kê
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Tổng hợp số liệu bán trú
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
