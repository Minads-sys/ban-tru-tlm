/**
 * Helper quản lý các Lớp thử nghiệm (Test Classes)
 * Đảm bảo các lớp thử nghiệm (như T01) hoàn toàn không xuất hiện trong:
 * 1. Tất cả các báo cáo tính toán, doanh thu, công nợ, thống kê học sinh
 * 2. Báo cáo chốt suất ăn nhà bếp hàng ngày, giao nhận cơm, phân chia sân ăn
 * 3. Danh sách hiển thị đối với tài khoản không phải ADMIN (Giáo viên, Kế toán, Thu ngân, Bếp...)
 */

export const DEFAULT_TEST_CLASS_IDS = ['T01'] as const;

/**
 * Kiểm tra 1 mã lớp có phải là lớp test hay không
 */
export function isTestClassId(classId?: string | null): boolean {
  if (!classId) return false;
  const upper = classId.trim().toUpperCase();
  return (
    DEFAULT_TEST_CLASS_IDS.includes(upper as any) ||
    upper === 'T01' ||
    upper.startsWith('TEST')
  );
}

/**
 * Bộ lọc Prisma cho trường `classId` để loại trừ các lớp test
 */
export const prismaExcludeTestClasses = {
  notIn: [...DEFAULT_TEST_CLASS_IDS],
};

/**
 * Bộ lọc Prisma cho quan hệ `student` để loại trừ học sinh thuộc lớp test
 */
export const prismaExcludeTestStudents = {
  classId: {
    notIn: [...DEFAULT_TEST_CLASS_IDS],
  },
};
