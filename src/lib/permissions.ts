export const PERMISSIONS = {
  MANAGE_USERS: "MANAGE_USERS",
  MANAGE_STUDENTS: "MANAGE_STUDENTS",
  MANAGE_MEALS: "MANAGE_MEALS",
  MANAGE_FINANCE: "MANAGE_FINANCE",
  VIEW_REPORTS: "VIEW_REPORTS",
  MANAGE_SETTINGS: "MANAGE_SETTINGS",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const PERMISSION_LABELS: Record<Permission, string> = {
  MANAGE_USERS: "Quản lý nhân sự & phân quyền",
  MANAGE_STUDENTS: "Quản lý học sinh, lớp & TKB",
  MANAGE_MEALS: "Quản lý suất ăn (Chốt suất, Duyệt hủy)",
  MANAGE_FINANCE: "Quản lý hóa đơn & thanh toán",
  VIEW_REPORTS: "Xem báo cáo thống kê",
  MANAGE_SETTINGS: "Cài đặt cấu hình hệ thống",
};

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function hasPermission(userPermissions: string[], permission: Permission): boolean {
  return userPermissions.includes(permission);
}
